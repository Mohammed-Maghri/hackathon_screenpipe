import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
const runs=Number(process.env.GHOST_TEST_RUNS||20), port=9340, debug=9230;
let variant=0;
const bundle=await build({entryPoints:['scripts/fixtures/dashboard.tsx'],bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"production"'}});
const standard=await readFile('scripts/fixtures/standard.html','utf8');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');if(req.url==='/app.js')res.end(bundle.outputFiles[0].text);else if(req.url.startsWith('/next'))res.end('<h1>Next page</h1>');else if(req.url.includes('kind=A'))res.end(standard);else res.end(`<html><head><title>Dashboard fixture</title><style>body{font:16px sans-serif;padding:10px}label{display:block;margin:6px}button{margin:6px}.layout-1 form{display:flex;flex-direction:column}.layout-1 label{order:1}.layout-1 button{order:2}</style></head><body><div id="root"></div><script>window.__variant=${variant}</script><script src="/app.js"></script></body></html>`)});
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
for(const kind of ['A','B','C'])for(let run=0;run<runs;run++){
variant=0;guest?.close();guest=null;
await host.eval(`location.hash='/workflows'`);await until(()=>host.eval(`!document.querySelector('.record-shell')`),'Old recording route did not close');
await host.eval(`window.__events=[];window.__state=null;window.__replay=null;location.hash='/workflows/orders/record/slack'`);
await until(()=>host.eval(`!!window.__state?.sessionId && !document.querySelector('[aria-label="Website address"]')?.disabled`),'Recording page not ready');
const token=await host.eval('window.__state.sessionId'), url=`http://127.0.0.1:${port}/?kind=${kind}`;
await api('navigate',token,url);
await until(()=>host.eval(`window.__state?.url.includes('${port}') && !window.__state.loading`),'Fixture navigation failed');
guest=await connect((await pages()).find(p=>p.url.includes(':'+port)));
await until(()=>guest.eval(`!!document.querySelector('form')`),'Fixture not ready');
await until(async()=> (await api('diagnostics',token)).captureReady,'Recorder not ready');
// Clear consent for this demonstration, then reload; retain it for replay.
const oldOrigin=await guest.eval(`performance.timeOrigin`);await guest.eval(`localStorage.removeItem('consent')`);await api('action',token,'reload');await until(()=>guest.eval(`performance.timeOrigin!==${oldOrigin} && document.readyState==='complete'`),'Reload did not complete');await until(()=>guest.eval(`!!document.querySelector('[role=dialog] button')`),'Consent missing');await guest.eval(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
await nativeClick('[role=dialog] button');await until(()=>guest.eval(`!document.querySelector('[aria-label="Cookie consent"]')`),'Cookie click not delivered');
await type('input:not([type=checkbox])','Orders');await type('textarea','Notes');
await nativeClick('input[type=checkbox]');await until(()=>guest.eval(`document.querySelector('input[type=checkbox]').checked`),'Checkbox click failed');
await guest.eval(`document.querySelector('select').focus()`);await guest.call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await guest.call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await until(()=>guest.eval(`document.querySelector('select').value==='eu'`),'Native select did not change');
await type('[contenteditable]','Summary');
await nativeClick('button[aria-expanded]');await until(()=>guest.eval(`!!document.querySelector('[aria-label=Filters]:not([hidden])')`),'Filters did not open');await pause(160);
await nativeClick('[aria-label=Filters] button');await until(()=>guest.eval(`document.querySelector('#filter-status').textContent==='Filters applied'`),'Filter not applied');await pause(160);
await nativeClick('button[type=submit]');await until(()=>guest.eval(`document.querySelector('#result').textContent==='Report saved'`),'Submit failed');await pause(160);
await host.eval(`document.querySelector('.stop-recording').click()`);await until(()=>host.eval(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Test recording')`),'Stop failed');
const recording=JSON.parse(await api('recordingExport',token));await writeFile(join(profile,'last-recording.json'),JSON.stringify(recording,null,2));
const plan=await api('replayPreview',token);assert.deepEqual(plan.blockers,[],JSON.stringify(plan.blockers));assert.ok(plan.inputs.length>=3);
const input=plan.inputs.find(i=>i.label==='Report name');assert.ok(input);input.value='Edited orders';await api('replaySaveInputs',token,plan.inputs);
assert.equal(JSON.parse(await api('recordingExport',token)).inputs.find(i=>i.sequence===input.sequence).value,'Edited orders');
// Changed UI: reorder classes/layout without changing destination or business identity.
variant=kind==='C'?run%2:0;
await host.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Test recording').click()`);await until(()=>host.eval(`!!document.querySelector('dialog[open]')`),'Preview not open');
await host.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Start test').click()`);
const approvals=new Set();
await until(async()=>{const status=await host.eval('window.__replay');if(!status)return false;if(status.state==='needs-user-approval'&&!approvals.has(status.sequence)){approvals.add(status.sequence);await host.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Approve this action')?.click()`)}return ['completed','failed','unknown','cancelled'].includes(status.state)},'Replay timed out',90000);
const result=await host.eval('window.__replay');assert.equal(result.state,'completed',JSON.stringify(result));
assert.equal(await guest.eval(`document.querySelector('input:not([type=checkbox])').value`),'Edited orders');assert.equal(await guest.eval('window.saves'),1);assert.deepEqual(await guest.eval(`({notes:document.querySelector('textarea').value,checked:document.querySelector('input[type=checkbox]').checked,region:document.querySelector('select').value,summary:document.querySelector('[contenteditable]').innerText})`),{notes:'Notes',checked:true,region:'eu',summary:'Summary'});assert.ok(!await guest.eval('window.wrongClicks'));assert.ok(result.results.every(r=>['verified','skipped'].includes(r.state)));
counts[kind]++;console.log(`PASS dashboard ${kind} ${counts[kind]}/${runs}: capture, preview, input override/export, approval, verified replay`);
}
console.log(JSON.stringify({counts,profile}));
await mkdir('out/test-results', { recursive: true });
await writeFile(runs>=20?'out/test-results/reliability-test-results.json':'out/test-results/reliability-smoke-results.json',JSON.stringify({date:new Date().toISOString(),counts,profile,platform:process.platform},null,2));
} catch(error){console.error('FAIL',error);if(host){console.error('Diagnostics',await host.eval(`window.__state && window.ghost.browser.diagnostics(window.__state.sessionId)`).catch(String));console.error('Replay',await host.eval('window.__replay').catch(String));}console.error('Profile',profile,'Electron log',errors.slice(-3000));process.exitCode=1}
finally{guest?.close();host?.close();electron.kill('SIGTERM');server.closeAllConnections();server.close();}
