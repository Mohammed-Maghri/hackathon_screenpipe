import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const port=9345, debug=9265;
let mode='normal';
const standard=await readFile('scripts/fixtures/failures.html','utf8');
const server=http.createServer((req,res)=>{
  if(mode==='redirect' && req.url.startsWith('/fixture')){res.writeHead(302,{Location:'/unexpected'});res.end();return}
  res.setHeader('Content-Type','text/html');let html=standard;
  if(['missing','changed-page'].includes(mode))html=html.replace('<button id="go">Save item</button>','');
  if(mode==='changed-id')html=html.replaceAll('id="go"','id="changed-go"').replaceAll("querySelector('#go')","querySelector('#changed-go')");
  if(mode==='slow')html=html.replace('<button id="go">Save item</button>','<button id="go" disabled>Save item</button>').replace('</body>',"<script>setTimeout(()=>document.querySelector('#go').disabled=false,500)</script></body>");
  if(mode==='duplicate')html=html.replace('<button id="go">Save item</button>','<button id="go">Save item</button><button id="go">Save item</button>');
  if(mode==='initial')html=html.replace('<span id="status" role="status"></span>','<span id="status" role="status">Saved item</span>');
  if(['unknown','interrupt','unverifiable'].includes(mode))html=html.replaceAll("window.saves++;document.querySelector('#status').textContent='Saved item'","window.saves++");
  if(mode==='frame')html=html.replace('</body>','<iframe style="display:block;margin-top:900px" src="/frame"></iframe></body>');
  if(req.url==='/frame')html='<h1>Frame</h1><button>Inside frame</button>';
  res.end(html)
});
await new Promise(r=>server.listen(port,'127.0.0.1',r));
const profile=await mkdtemp(join(tmpdir(),'ghost-reliability-'));
const electron=spawn(electronPath,['.',`--ozone-platform=${process.env.GHOST_TEST_PLATFORM || 'x11'}`,`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`],{stdio:['ignore','ignore','pipe']});
let errors='';electron.stderr.on('data',d=>{errors+=d.toString()});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message,timeout=20000){const start=Date.now();do{const v=await fn();if(v)return v;await pause(50)}while(Date.now()-start<timeout);throw Error(message)}
async function connect(target){const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let n=0;const pending=new Map();ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);if(!p)return;pending.delete(d.id);clearTimeout(p.timer);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result)}};return {close(){ws.close()},call(method,params={}){return new Promise((resolve,reject)=>{const id=++n;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))})},async eval(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}}}
const pages=()=>fetch(`http://127.0.0.1:${debug}/json`).then(r=>r.json());
let host,guest;const counts={A:0,B:0,C:0};
try{
await until(async()=>{try{return (await pages()).length}catch{return false}},'Electron did not start');
host=await connect((await pages()).find(p=>p.url.includes('index.html')));
await until(()=>host.eval('!!window.ghost?.browser'),'Host preload missing');
await host.eval(`window.__state=null;window.__replay=null;window.__events=[];window.ghost.browser.onState(s=>window.__state=s);window.ghost.browser.onReplay(s=>window.__replay=s.status);window.ghost.browser.onRecorded(s=>window.__events.push(s.event));`);
async function api(method,...args){return host.eval(`window.ghost.browser[${JSON.stringify(method)}](...${JSON.stringify(args)})`)}
async function nativeClick(selector){const point=await guest.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('No element');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
async function type(selector,text){await nativeClick(selector);await guest.call('Input.insertText',{text});await until(()=>guest.eval(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(text)} || document.querySelector(${JSON.stringify(selector)}).innerText===${JSON.stringify(text)}`),'Native typing did not reach field');}
async function open(scenario='normal') {
  mode=scenario;guest?.close();guest=null;
  await host.eval(`location.hash='/workflows'`);await until(()=>host.eval(`!document.querySelector('.record-shell')`),'Old route did not close');
  await host.eval(`window.__state=null;window.__replay=null;window.__events=[];location.hash='/workflows/orders/record/slack'`);
  await until(()=>host.eval(`!!window.__state?.sessionId && !document.querySelector('[aria-label="Website address"]')?.disabled`),'Recording not ready');
  const token=await host.eval('window.__state.sessionId');await api('navigate',token,`http://127.0.0.1:${port}/fixture`);
  await until(()=>host.eval(`window.__state?.url.includes('${port}') && !window.__state.loading`),'Fixture navigation failed');
  guest=await connect((await pages()).find(p=>p.url.includes(':'+port+'/fixture')));
  await until(()=>guest.eval(`document.readyState==='complete' && !!document.querySelector('#go')`),'Fixture not loaded');
  await guest.eval(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  return token;
}
const stop=token=>api('recordingControl',token,'stop');
const preview=token=>api('replayPreview',token);

const checks=[];
async function capture(captureMode='normal') {
 const token=await open(captureMode);
 await type('#name','Saved input');
 await nativeClick('#go');
 await until(()=>guest.eval("window.saves===1"),'Capture submit failed');
 await stop(token);assert.deepEqual((await preview(token)).blockers,[]);
 guest.close();guest=null;return token;
}
async function replay(token,resume=false) {
 await host.eval('window.__replay=null');
 await api('replayStart',token,true,resume);
 await until(()=>host.eval("window.__replay && ['completed','failed','unknown','cancelled'].includes(window.__replay.state)"),'Replay status timeout',45000);
 const result=await host.eval('window.__replay');
 await pause(80);
 return result;
}
async function inspectGuest() { guest?.close();guest=await connect((await pages()).find(p=>p.url.includes(':'+port+'/fixture'))); }
async function saved(token) {const {path}=await api('recordingStatus',token);return JSON.parse(await readFile(join(path,'last-replay.json'),'utf8'));}
const token=await capture();
await host.eval('window.__replay=null');
const started=Date.now();await api('replayStart',token,true,false,'demo');
await inspectGuest();
await until(()=>guest.eval("!!document.getElementById('ghost-replay-demo-overlay')"),'Demo highlight missing');
assert.equal(await guest.eval("getComputedStyle(document.getElementById('ghost-replay-demo-overlay')).pointerEvents"),'none');
await until(()=>host.eval("window.__replay?.state==='completed'"),'Demo replay failed',45000);
assert.ok(Date.now()-started>=3000,'Demo did not slow down');
assert.equal(await guest.eval('window.saves'),1);
await until(()=>guest.eval("!document.getElementById('ghost-replay-demo-overlay')"),'Overlay not cleaned');
console.log('PASS demo: paced execution, non-interactive highlight, verified single submission, cleanup');
await api('replayStart',token,true,false,'demo');
await until(()=>guest.eval("!!document.getElementById('ghost-replay-demo-overlay')"),'Cancellation highlight missing');
await api('replayCancel',token);
await until(()=>host.eval("window.__replay?.state==='cancelled'"),'Demo cancellation missing');
await until(()=>guest.eval("!document.getElementById('ghost-replay-demo-overlay')"),'Cancelled overlay not cleaned');
assert.equal(await guest.eval('window.saves'),0);
console.log('PASS demo: cancellation during pause prevents submission');
const result=await replay(token);
assert.equal(result.state,'completed');assert.equal(await guest.eval('window.saves'),1);
assert.equal(await guest.eval("!!document.getElementById('ghost-replay-demo-overlay')"),false);
console.log('PASS fast: original mode remains verified and has no overlay');
} catch(error){console.error('FAIL',error);if(host){console.error('Diagnostics',await host.eval(`window.__state && window.ghost.browser.diagnostics(window.__state.sessionId)`).catch(String));console.error('Replay',await host.eval('window.__replay').catch(String));}console.error('Profile',profile,'Electron log',errors.slice(-3000));process.exitCode=1}
finally{guest?.close();host?.close();electron.kill('SIGTERM');server.closeAllConnections();server.close();}
