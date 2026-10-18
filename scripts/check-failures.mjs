import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const port=Number(process.env.GHOST_TEST_PORT||9341), debug=Number(process.env.GHOST_DEBUG_PORT||9231);
let mode='normal';
const standard=await readFile('scripts/fixtures/failures.html','utf8');
const server=http.createServer((req,res)=>{
  if(mode==='redirect' && req.url.startsWith('/fixture')){res.writeHead(302,{Location:'/unexpected'});res.end();return}
  res.setHeader('Content-Type','text/html');let html=standard;
  if(mode==='missing')html=html.replace('<button id="go">Save item</button>','');
  if(mode==='duplicate')html=html.replace('<button id="go">Save item</button>','<button id="go">Save item</button><button id="go">Save item</button>');
  if(mode==='initial')html=html.replace('<span id="status" role="status"></span>','<span id="status" role="status">Saved item</span>');
  if(mode==='unknown')html=html.replaceAll("window.saves++;document.querySelector('#status').textContent='Saved item'","window.saves++");
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
const checks=[];checks.push=(...items)=>{console.log('PASS',...items);return Array.prototype.push.apply(checks,items)};
let token=await open();await stop(token);assert.ok((await preview(token)).blockers.some(b=>b.includes('no replayable')));checks.push('empty recording blocked');
token=await open();await api('recordingControl',token,'pause');const before=await api('recordingStatus',token);await type('#name','Paused');assert.equal((await api('recordingStatus',token)).eventCount,before.eventCount);await api('recordingControl',token,'resume');await nativeClick('#go');await until(()=>guest.eval('window.saves===1'),'Manual click failed');
await guest.eval(`document.querySelector('#scroll').scrollTop=110`);await until(()=>guest.eval('window.scrollSeen'),'Scroll not delivered');await stop(token);let data=JSON.parse(await api('recordingExport',token));assert.ok(data.events.some(e=>e.type==='scroll'&&e.data.scrollTop===110));assert.ok(!data.events.some(e=>e.data.value==='Paused'));checks.push('pause/resume and stop flushes pending scroll');
// Modal visibility and native pointer delivery, via the real host UI.
token=await open();await host.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Need help')).click()`);await until(async()=>!(await api('diagnostics',token)).visible,'View not hidden for modal');await host.eval(`document.querySelector('.dialog-close').click()`);await until(async()=>(await api('diagnostics',token)).visible,'View not restored');await nativeClick('#go');await until(()=>guest.eval('window.saves===1'),'Click after modal failed');checks.push('modal bounds/visibility and manual click delivery');await stop(token);
for(const field of ['password','otp']) {token=await open();await type('#'+field,'DO-NOT-STORE');await stop(token);const json=await api('recordingExport',token);assert.ok(!json.includes('DO-NOT-STORE'));assert.deepEqual((await preview(token)).blockers,[]);assert.ok((await preview(token)).inputs.some(input=>input.secret&&input.saved));}checks.push('password/OTP encrypted, preview masked, no plaintext export');
token=await open('frame');await nativeClick('#go');await until(()=>guest.eval('window.saves===1'),'Main-page save failed');await stop(token);assert.deepEqual((await preview(token)).blockers,[]);
await host.eval('window.__replay=null');await api('replayStart',token);const frameApprovals=new Set();await until(async()=>{const state=await host.eval('window.__replay');if(state?.state==='needs-user-approval'&&!frameApprovals.has(state.sequence)){frameApprovals.add(state.sequence);await api('replayApprove',token,state.sequence,true)}return state && ['completed','failed','unknown'].includes(state.state)},'Main-page replay with iframe timed out');assert.equal((await host.eval('window.__replay')).state,'completed');checks.push('main-page recording and verified replay with an unrelated iframe');
token=await open();await guest.eval(`(()=>{const frame=document.createElement('iframe');frame.hidden=true;frame.src='/frame';document.body.append(frame)})()`);await nativeClick('#go');await stop(token);assert.deepEqual((await preview(token)).blockers,[]);checks.push('dynamically inserted unused iframe does not block main-page capture');
if (!process.env.GHOST_TEST_FRAMES_ONLY) {
token=await open();await nativeClick('#popup');await until(async()=>JSON.parse(await api('recordingExport',token)).events.some(e=>e.type==='popup-open'),'Popup not recorded');await stop(token);assert.ok((await preview(token)).blockers.some(b=>b.includes('popup-open')));await assert.rejects(()=>api('replayStart',token));checks.push('popup blocker preserved through IPC');
token=await open();const point=await guest.eval(`(()=>{const e=document.querySelector('#drag');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+20,y:r.y+20}})()`);await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await guest.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+50,y:point.y,button:'left',buttons:1});await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+50,y:point.y,button:'left',clickCount:1});await stop(token);assert.ok((await preview(token)).blockers.some(b=>b.includes('drag-move')));await assert.rejects(()=>api('replayStart',token));checks.push('drag blocker preserved through IPC');
for(const scenario of ['missing','duplicate','initial','redirect','unknown','cancel','deny']) {
  token=await open();await nativeClick('#go');await until(()=>guest.eval(`document.querySelector('#status').textContent==='Saved item'`),'Save not observed');await stop(token);assert.deepEqual((await preview(token)).blockers,[]);
  mode=['cancel','deny'].includes(scenario)?'normal':scenario;await host.eval('window.__replay=null');await api('replayStart',token);
  const approvals=new Set();
  await until(async()=>{const status=await host.eval('window.__replay');if(!status)return false;if(status.state==='needs-user-approval'&&!approvals.has(status.sequence)){approvals.add(status.sequence);if(scenario==='cancel')await api('replayCancel',token);else await api('replayApprove',token,status.sequence,scenario!=='deny')}return ['completed','failed','unknown','cancelled'].includes(status.state)},'Negative replay did not terminate',35000);
  const result=await host.eval('window.__replay');assert.equal(result.state,scenario==='unknown'?'unknown':scenario==='cancel'?'cancelled':'failed',JSON.stringify(result));
  const saves=await guest.eval('window.saves');assert.equal(saves,scenario==='unknown'?1:0);checks.push(scenario+' stops without retry or unintended dispatch');
}
token=await open();await nativeClick('#input-button');await until(()=>guest.eval('window.saves===1'),'Input button did not click');await stop(token);await host.eval('window.__replay=null');await api('replayStart',token);await until(()=>host.eval(`window.__replay?.state==='needs-user-approval'`),'Input button bypassed approval');assert.equal(await guest.eval('window.saves'),0);await api('replayApprove',token,(await host.eval('window.__replay')).sequence,false);await until(()=>host.eval(`window.__replay?.state==='failed'`),'Denied input button did not stop');checks.push('input-element action buttons require approval before dispatch');
// Navigation and select-all are exercised through captured native events as well.
token=await open();await nativeClick('#next');await until(()=>guest.eval(`location.pathname==='/next'`),'Manual navigation failed');await api('action',token,'back');await until(()=>guest.eval(`location.pathname==='/fixture'`),'Browser back failed');await api('action',token,'forward');await until(()=>guest.eval(`location.pathname==='/next'`),'Browser forward failed');await stop(token);await host.eval('window.__replay=null');await api('replayStart',token);const approved=new Set();await until(async()=>{const state=await host.eval('window.__replay');if(state?.state==='needs-user-approval'&&!approved.has(state.sequence)){approved.add(state.sequence);await api('replayApprove',token,state.sequence,true)}return state && ['completed','failed','unknown'].includes(state.state)},'Navigation replay timed out');assert.equal((await host.eval('window.__replay')).state,'completed');assert.equal(await guest.eval('location.pathname'),'/next');checks.push('captured link and browser back/forward navigation verified');
token=await open();await type('#name','Existing');await guest.call('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await guest.call('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await guest.call('Input.insertText',{text:'Replacement'});await until(()=>guest.eval(`document.querySelector('#name').value==='Replacement'`),'Select-all typing failed');await stop(token);await host.eval('window.__replay=null');await api('replayStart',token);await until(()=>host.eval(`window.__replay && ['completed','failed','unknown'].includes(window.__replay.state)`),'Input replay did not finish');assert.equal((await host.eval('window.__replay')).state,'completed');assert.equal(await guest.eval(`document.querySelector('#name').value`),'Replacement');checks.push('Ctrl+A and native replacement verified');
}
console.log('PASS failure cases:',checks);
await mkdir('out/test-results', { recursive: true });
await writeFile(process.env.GHOST_TEST_FRAMES_ONLY ? 'out/test-results/reliability-frame-results.json' : 'out/test-results/reliability-failure-results.json',JSON.stringify({date:new Date().toISOString(),checks},null,2));
console.log(JSON.stringify({counts,profile}));

} catch(error){console.error('FAIL',error);if(host){console.error('Diagnostics',await host.eval(`window.__state && window.ghost.browser.diagnostics(window.__state.sessionId)`).catch(String));console.error('Replay',await host.eval('window.__replay').catch(String));}console.error('Profile',profile,'Electron log',errors.slice(-3000));process.exitCode=1}
finally{guest?.close();host?.close();electron.kill('SIGTERM');server.closeAllConnections();server.close();}
