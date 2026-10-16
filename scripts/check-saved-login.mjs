import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
const debug=9259;
let submissions=0;
const server=http.createServer((req,res)=>{
 res.setHeader('Content-Type','text/html');
 if(req.url==='/authenticate'){submissions++;res.writeHead(302,{Location:'/dashboard'});res.end();return}
 res.end(req.url==='/dashboard'?`<html><body><h1>Dashboard</h1><button id="save" onclick="document.getElementById('status').textContent='Saved'">Save report</button><p role="status" id="status"></p></body></html>`:`<html><body><form onsubmit="event.preventDefault();if(document.querySelector('#email').value==='demo@example.test'&&document.querySelector('#password').value==='demo-password')location.href='/authenticate'"><label for="email">Email</label><input id="email" type="email"><label for="password">Password</label><input id="password" type="password"><button id="login" type="submit">Sign in</button></form></body></html>`)
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const stalledURL='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(join(tmpdir(),'ghost-reliability-'));
const electron=spawn(electronPath,['.','--ozone-platform=x11','--password-store=basic',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`],{stdio:['ignore','ignore','pipe']});
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
async function api(method,...args){console.log('API',method);return host.eval(`window.ghost.browser[${JSON.stringify(method)}](...${JSON.stringify(args)})`)}
async function nativeClick(selector){const point=await guest.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('No element');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
async function type(selector,text){await nativeClick(selector);await guest.call('Input.insertText',{text});await until(()=>guest.eval(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(text)} || document.querySelector(${JSON.stringify(selector)}).innerText===${JSON.stringify(text)}`),'Native typing did not reach field');}
await host.eval(`location.hash='/workflows/orders/record/slack'`);
await until(()=>host.eval(`!!window.__state?.sessionId`),'Teaching route missing');
const token=await host.eval('window.__state.sessionId');
await api('navigate',token,stalledURL+'/login');
await until(async()=>{const p=(await pages()).find(p=>p.url.startsWith(stalledURL));if(!p)return false;guest=await connect(p);return true},'Login fixture missing');
await until(()=>host.eval(`window.__state?.authenticationPaused===true && document.body.textContent.includes('Capture paused for sign-in')`),'Automatic auth pause missing');
assert.equal((await api('recordingStatus',token)).state,'paused');
const summary=await api('loginSave',token,{loginURL:stalledURL+'/login',successURL:stalledURL+'/dashboard',username:'demo@example.test',password:'demo-password',remember:false});
assert.equal(summary.configured,true);assert.equal(summary.password,undefined);
guest?.close();guest=null;
await api('loginRun',token);
assert.equal(submissions,1);
await until(()=>host.eval(`window.__state?.url.endsWith('/dashboard')`),'Login did not navigate');
const prior=await api('recordingExport',token);assert.ok(!prior.includes('demo-password'));assert.ok(!prior.includes('demo@example.test'));
await host.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Start task recording').click()`);
await until(()=>host.eval(`!!window.__state?.sessionId && window.__state.sessionId!==${JSON.stringify(token)} && !window.__state.authenticationPaused && window.__state.url.endsWith('/dashboard')`),'Fresh task recording missing');
const fresh=await host.eval('window.__state.sessionId');
guest?.close();guest=await connect((await pages()).find(p=>p.url.startsWith(stalledURL)));
await until(()=>guest.eval(`!!document.querySelector('#save')`),'Dashboard missing');await nativeClick('#save');
await until(()=>guest.eval(`document.querySelector('#status').textContent==='Saved'`),'Task interaction failed');
await api('recordingControl',fresh,'stop');
const plan=await api('replayPreview',fresh);assert.deepEqual(plan.blockers,[]);assert.equal(plan.startURL,stalledURL+'/dashboard');
guest?.close();guest=null;
await api('replayStart',fresh);
await until(async()=>{
 const status=await host.eval('window.__replay');
 if(status?.state==='needs-user-approval')await api('replayApprove',fresh,status.sequence,true);
 if(status?.state==='failed')throw Error(JSON.stringify(status));
 return status?.state==='completed';
},'Replay did not complete',40000);
assert.equal(submissions,2,'Replay must sign in using saved credentials');
assert.ok(!(await api('recordingExport',fresh)).includes('demo-password'));
await api('loginRemove',fresh);
assert.equal((await api('loginStatus',fresh)).configured,false);
assert.ok(!/UnhandledPromiseRejection/.test(errors),errors);
console.log('PASS: native saved login, password excluded from exports/summary, scoped login retained across recording, automatic login before verified replay, forget login');
}catch(error){try { const page=(await pages()).find(p=>p.url.startsWith(stalledURL));if(page){const c=await connect(page);console.error('FORM',await c.eval("({url:location.pathname,email:document.querySelector('#email')?.value==='demo@example.test',password:document.querySelector('#password')?.value==='demo-password'})"));c.close()} }catch{} console.error(error,errors);process.exitCode=1}
finally{clearTimeout(watchdog);guest?.close();host?.close();electron.kill('SIGTERM');server.closeAllConnections();server.close()}
