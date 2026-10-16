import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
const debug=9257;
const server=http.createServer((req,res)=>{if(req.url==='/export'){res.writeHead(200,{'Content-Type':'text/csv','Content-Disposition':'attachment; filename="report.csv"'});res.end('customer,total\nAcme,1250\n');return}res.setHeader('Content-Type','text/html');res.end('<html><body><h1>Export fixture</h1><a href="/export" id="export" data-testid="export">Export report</a></body></html>')});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const stalledURL='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(join(tmpdir(),'ghost-reliability-'));
const electron=spawn(electronPath,['.',`--ozone-platform=${process.env.GHOST_TEST_PLATFORM || 'x11'}`,`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`],{stdio:['ignore','ignore','pipe']});
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
const token=await host.eval('window.__state.sessionId');
await api('navigate',token,stalledURL);
await until(async()=>{const p=(await pages()).find(p=>p.url.startsWith(stalledURL));if(!p)return false;guest=await connect(p);return true},'Export fixture missing');
await until(()=>guest.eval(`!!document.querySelector('#export')`),'Export button missing');
await nativeClick('#export');
await until(async()=>JSON.parse(await api('recordingExport',token)).events.some(e=>e.type==='download-done'&&e.data.state==='completed'),'Download completion not captured');
await host.eval(`document.querySelector('.stop-recording').click()`);
await until(()=>host.eval(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Test recording')`),'Stop failed');
const plan=await api('replayPreview',token);assert.deepEqual(plan.blockers,[]);
await host.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Test recording').click()`);
await until(()=>host.eval(`!!document.querySelector('dialog[open]')`),'Preview missing');
const geometry=(await api('diagnostics',token)).bounds;
await host.eval(`window.ghost.browser.bounds(${JSON.stringify(token)},${JSON.stringify({...geometry,visible:true})})`);
await pause(100);
assert.equal((await api('diagnostics',token)).visible,false,'Stale bounds must not reveal the native browser over a dialog');
console.log('PASS modal: stale visible bounds cannot cover the replay dialog');

await host.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Start test · Fast').click()`);
const approved=new Set();
await until(async()=>{const s=await host.eval('window.__replay');if(s?.state==='needs-user-approval'&&!approved.has(s.sequence)){approved.add(s.sequence);await host.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Approve this action')?.click()`)}return s&&['completed','failed','unknown','cancelled'].includes(s.state)},'Replay did not finish',70000);
const result=await host.eval('window.__replay');assert.equal(result.state,'completed',JSON.stringify(result));
assert.ok(result.results.some(r=>r.evidence?.includes('Download completed')));
await until(()=>host.eval("!!document.querySelector('.run-summary')"),'Run summary did not open');
assert.equal(result.artifacts.length,1);
const artifact=result.artifacts[0];assert.equal(artifact.state,'completed');assert.equal(artifact.filename,'report.csv');
const text=await api('replayArtifact',token,result.runId,artifact.id,'preview');assert.ok(text.includes('Acme,1250'));
await assert.rejects(()=>api('replayArtifact',token,result.runId,'../../session.json','preview'));
await assert.rejects(()=>api('replayArtifact',token,'../../session',artifact.id,'preview'));
const path=(await api('recordingStatus',token)).path;
const saved=JSON.parse(await readFile(join(path,'runs',result.runId+'.json'),'utf8'));
assert.equal(saved.artifacts[0].path,artifact.path);assert.equal(saved.state,'completed');
await host.eval("[...document.querySelectorAll('.run-summary button')].find(b=>b.textContent==='Preview').click()");
await until(()=>host.eval("document.querySelector('.run-file-preview')?.textContent.includes('Acme,1250')"),'CSV preview missing');
assert.equal((await api('diagnostics',token)).visible,false,'Native browser must not cover results');
await host.eval("[...document.querySelectorAll('.run-summary button')].find(b=>b.textContent==='Back to browser').click()");
await until(async()=>(await api('diagnostics',token)).visible,'Browser not restored');
console.log('PASS results: automatic summary, CSV preview, persisted report, scoped file access, native view visibility');
await host.eval('window.__replay=null');await api('replayStart',token,true);
await until(()=>host.eval("window.__replay?.state==='completed'"),'Second run failed');
const second=await host.eval('window.__replay');assert.notEqual(second.runId,result.runId);
assert.notEqual(second.artifacts[0].path,artifact.path);
assert.equal(JSON.parse(await readFile(join(path,'runs',result.runId+'.json'),'utf8')).runId,result.runId);
assert.equal(JSON.parse(await readFile(join(path,'runs',second.runId+'.json'),'utf8')).runId,second.runId);
await until(()=>host.eval("!!document.querySelector('.run-summary')"),'Second summary missing');
await host.eval("[...document.querySelectorAll('.run-summary button')].find(b=>b.textContent==='Back to browser').click()");
console.log('PASS results: repeated runs preserve separate reports and downloaded files');

assert.ok(!/UnhandledPromiseRejection/.test(errors),errors);
await host.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent==='New recording on this page').click()`);
await until(()=>host.eval(`window.__state?.sessionId !== ${JSON.stringify(token)} && !!window.__state?.sessionId`),'Fresh recording did not open');
const fresh=await host.eval('window.__state.sessionId');
assert.equal((await api('recordingStatus',fresh)).state,'recording');
assert.ok(!JSON.parse(await api('recordingExport',fresh)).events.some(e=>e.type==='download-start'));
console.log('PASS: fresh recording after completion; real Electron download recording, completion persistence, preview, approval and verified file replay');
}catch(error){console.error(error);process.exitCode=1}
finally{clearTimeout(watchdog);guest?.close();host?.close();electron.kill('SIGTERM');server.closeAllConnections();server.close()}
