import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
const debug=9256;
const server=http.createServer(()=>{});
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
async function type(selector,text){await nativeClick(selector);await guest.call('Input.insertText',{text});await until(()=>guest.eval(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(text)} || document.querySelector(${JSON.stringify(selector)}).innerText===${JSON.stringify(text)}`),'Native typing did not reach field');}
await host.eval(`location.hash='/workflows/orders/record/slack'`);
await until(()=>host.eval(`!!window.__state?.sessionId`),'Teaching route missing');
const initial=await host.eval('window.__state.sessionId');
await api('close',initial);
for(let i=0;i<20;i++){
 const token='lifecycle-'+i;
 await api('open',token,stalledURL,{x:250,y:220,width:600,height:400,visible:true});
 if(i%2===0)await api('close',token);
 else {await api('open',token+'-replacement','about:blank',{x:250,y:220,width:600,height:400,visible:true});await api('close',token+'-replacement');}
}
// Close while restoration is pending, without awaiting open first.
for (let i = 0; i < 20; i++) {
 await host.eval(`(async()=>{const token='pending-${i}';const opening=window.ghost.browser.open(token,${JSON.stringify(stalledURL)},{x:250,y:220,width:600,height:400,visible:true}).catch(()=>null);await window.ghost.browser.close(token);await opening})()`);
}
await pause(300);
assert.equal((await pages()).filter(p=>p.type==='page' && p.id!==undefined).length,1,'Closing during startup left an orphan browser');
// Competing opens must leave only the newest native view alive.
await host.eval(`Promise.allSettled(Array.from({length:10},(_,i)=>window.ghost.browser.open('competing-'+i,${JSON.stringify(stalledURL)},{x:250,y:220,width:600,height:400,visible:true})))`);
await api('close','competing-9');
await pause(300);
assert.equal((await pages()).filter(p=>p.type==='page').length,1,'Concurrent startup left an orphan browser');
await host.eval(`(async()=>{const opening=window.ghost.browser.open('leaving',${JSON.stringify(stalledURL)},{x:250,y:220,width:600,height:400,visible:true}).catch(()=>null);location.hash='/workflows';await opening})()`);
await pause(300);
assert.equal((await pages()).filter(p=>p.type==='page').length,1,'Leaving the route left a browser visible');
console.log('PASS: startup cancellation, concurrent opens, and route exit leave no orphan browsers');
await pause(500);
assert.ok(!/UnhandledPromiseRejection|Cannot read properties of undefined/.test(errors),errors);
console.log('PASS: 20 pending navigations closed/replaced with no unhandled rejection');
}catch(error){console.error(error);process.exitCode=1}
finally{clearTimeout(watchdog);guest?.close();host?.close();electron.kill('SIGTERM');server.closeAllConnections();server.close()}
