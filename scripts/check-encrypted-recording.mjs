import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
const debug=9260;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url==='/dashboard'?`<html><body><h1>Dashboard</h1><button id="save" onclick="document.getElementById('status').textContent='Saved'">Save report</button><p role="status" id="status"></p></body></html>`:`<html><body><h1>Sign in</h1><label for="email">Email</label><input id="email"><label for="password">Password</label><input id="password" type="password"><button id="login" onclick="location.href='/dashboard'">Sign in</button></body></html>`)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const stalledURL='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(join(tmpdir(),'ghost-reliability-'));
const electron=spawn(electronPath,['.','--ozone-platform=x11',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`],{stdio:['ignore','ignore','pipe']});
const watchdog=setTimeout(()=>{console.error('Fixture test timed out');electron.kill('SIGTERM');process.exit(1)},90000);
let errors='';electron.stderr.on('data',d=>{errors+=d.toString()});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message,timeout=20000){const start=Date.now();do{const v=await fn();if(v)return v;await pause(50)}while(Date.now()-start<timeout);throw Error(message)}
async function connect(target){const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let n=0;const pending=new Map();ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);if(!p)return;pending.delete(d.id);clearTimeout(p.timer);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result)}};return {close(){ws.close()},call(method,params={}){return new Promise((resolve,reject)=>{const id=++n;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))})},async eval(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}}}
const pages=()=>fetch(`http://127.0.0.1:${debug}/json`).then(r=>r.json());
let host,guest;
try{
await until(async()=>{try{return (await pages()).length}catch{return false}},'Electron did not start');
host=await connect((await pages()).find(p=>p.url.includes('index.html')));
await until(()=>host.eval('!!window.ghost?.browser'),'Host preload missing');
await host.eval(`window.__state=null;window.__replay=null;window.__events=[];window.ghost.browser.onState(s=>window.__state=s);window.ghost.browser.onReplay(s=>window.__replay=s.status);window.ghost.browser.onRecorded(s=>window.__events.push(s.event));`);
async function api(method,...args){return host.eval(`window.ghost.browser[${JSON.stringify(method)}](...${JSON.stringify(args)})`)}
async function nativeClick(selector){const point=await guest.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('No element');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
async function type(selector,text){await guest.call('Emulation.setFocusEmulationEnabled',{enabled:true});await guest.eval(`document.querySelector(${JSON.stringify(selector)}).focus()`);await guest.call('Input.insertText',{text});await until(()=>guest.eval(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(text)} || document.querySelector(${JSON.stringify(selector)}).innerText===${JSON.stringify(text)}`),'Native typing did not reach field');}
await host.eval(`location.hash='/workflows/orders/record/slack'`);
await until(()=>host.eval(`!!window.__state?.sessionId`),'Teaching route missing');
const token=await host.eval('window.__state.sessionId');
await api('navigate',token,stalledURL+'/login');
await until(async()=>{const p=(await pages()).find(p=>p.url.startsWith(stalledURL));if(!p)return false;guest=await connect(p);return true},'Login fixture missing');
assert.equal((await api('recordingStatus',token)).state,'recording');
await type('#email','demo@example.test');
await api('recordingControl',token,'pause');
await type('#password','old-password');
await api('recordingControl',token,'resume');
await guest.eval("document.querySelector('#password').select()");
await type('#password','demo-password');
await nativeClick('#login');
await until(()=>host.eval(`window.__state?.url.endsWith('/dashboard')`),'Login did not navigate');
const prior=await api('recordingExport',token);assert.ok(!prior.includes('demo-password'));assert.ok(prior.includes('encryptedValue'));
const fresh=token;
await until(()=>guest.eval(`!!document.querySelector('#save')`),'Dashboard missing');await nativeClick('#save');
await until(()=>guest.eval(`document.querySelector('#status').textContent==='Saved'`),'Task interaction failed');
await api('recordingControl',fresh,'stop');
const builtPage=await build({entryPoints:['src/shared/pageOperation.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {pageOperation}=await import('data:text/javascript;base64,'+Buffer.from(builtPage.outputFiles[0].text).toString('base64'));
await guest.eval(`(()=>{const area=document.createElement('section');area.id='locator-fixture';area.innerHTML='<button></button><button></button>';document.body.append(area)})()`);
const locate=target=>guest.eval(`(${pageOperation.toString()})(${JSON.stringify({op:'locate',target})})`);
assert.equal((await locate({selector:'#locator-fixture > button:nth-of-type(1)',tag:'button'})).found,true);
await assert.rejects(()=>locate({selector:'#locator-fixture > button',tag:'button'}),/Ambiguous target/);
assert.equal((await locate({selector:'#locator-fixture > aside',tag:'aside'})).found,false);
await guest.eval("document.querySelector('#locator-fixture').remove()");

const plan=await api('replayPreview',fresh);assert.deepEqual(plan.blockers,[]);assert.equal(plan.startURL,stalledURL+'/login');
const secret=plan.inputs.find(input=>input.secret);
assert.ok(secret?.saved,'Encrypted password must appear in preview');
assert.equal(secret.value,'','Preview must never return plaintext');
await api('replaySaveInputs',fresh,plan.inputs.map(input=>input.secret?{...input,value:'demo-password'}:input));
const updated=await api('replayPreview',fresh);
assert.ok(updated.inputs.find(input=>input.secret)?.saved);
assert.ok(!(await api('recordingExport',fresh)).includes('demo-password'));
await api('replaySaveInputs',fresh,updated.inputs); // Blank replacement keeps encrypted override.
guest.close();guest=null;
await api('replayStart',fresh);
await until(async()=>{
 const status=await host.eval('window.__replay');
 if(status?.state==='needs-user-approval')await api('replayApprove',fresh,status.sequence,true);
 if(status?.state==='failed')throw Error(JSON.stringify(status));
 return status?.state==='completed';
},'Encrypted recording replay did not complete',40000);
assert.ok(!/UnhandledPromiseRejection/.test(errors),errors);
console.log('PASS: encrypted password capture, secret-free export, blocker-free login preview and verified full login/task replay');
}catch(error){console.error(error);process.exitCode=1}
finally{clearTimeout(watchdog);guest?.close();host?.close();electron.kill('SIGTERM');server.closeAllConnections();server.close()}
