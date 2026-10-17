import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const debug=9273;
const id='40000000-0000-4000-8000-000000000000', browserId='40000000-0000-4000-8000-000000000001', logicId='40000000-0000-4000-8000-000000000002';
let workflow={id,name:'Contract UI test',description:'Filter requests',status:'DRAFT',updatedAt:new Date().toISOString(),nodes:[
{id:browserId,type:'ACTION',label:'Export requests',positionX:80,positionY:100,config:{stepType:'browser',status:'needs_recording',description:'Export requests',instructions:[]}},
{id:logicId,type:'ACTION',label:'Merge reports',positionX:370,positionY:100,config:{stepType:'data_processing',status:'needs_configuration',description:'Read exported reports locally.',instructions:[],dataProcessing:{version:1,operation:'merge_files',inputs:{},rules:{}}}},
],edges:[{id:'50000000-0000-4000-8000-000000000001',sourceNodeId:browserId,targetNodeId:logicId}]};
const server=http.createServer(async(req,res)=>{
res.setHeader('Content-Type','application/json');
if(req.method==='PATCH'){let body='';for await(const chunk of req)body+=chunk;workflow={...workflow,...JSON.parse(body)};}
res.end(JSON.stringify(workflow));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const profile=await mkdtemp(join(tmpdir(),'ghost-contract-ui-'));
const electron=spawn(electronPath,['.','--ozone-platform=x11',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`],{env:{...process.env,GHOST_BACKEND_URL:`http://127.0.0.1:${server.address().port}`},stdio:['ignore','ignore','pipe']});
const watchdog=setTimeout(()=>{electron.kill('SIGTERM');process.exit(1)},60000);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message,timeout=20000){const start=Date.now();do{const v=await fn();if(v)return v;await pause(50)}while(Date.now()-start<timeout);throw Error(message)}
async function connect(target){const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let n=0;const pending=new Map();ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);if(!p)return;pending.delete(d.id);clearTimeout(p.timer);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result)}};return {close(){ws.close()},call(method,params={}){return new Promise((resolve,reject)=>{const id=++n;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))})},async eval(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}}}
const pages=()=>fetch(`http://127.0.0.1:${debug}/json`).then(r=>r.json());
let host;
try {
await until(async()=>{try{return (await pages()).length}catch{return false}},'Electron did not start');
host=await connect((await pages()).find(page=>page.url.includes('index.html')));
await until(()=>host.eval('!!window.ghost?.processing'),'Contract preload missing');
await host.eval(`location.hash='/workflows/${id}'`);
await until(()=>host.eval("[...document.querySelectorAll('button')].some(b=>b.textContent==='Define inputs & outputs')"),'Definition button missing');
await host.eval(`document.querySelector('.node-${logicId}').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }))`);
await until(()=>host.eval("!!document.querySelector('.processing-inspector')"),'Inspector missing');
assert.equal(await host.eval("!!document.querySelector('.processing-errors')"),true);
await host.eval(`(()=>{const select=document.querySelector('[aria-label="Input files"]');select.value=JSON.stringify([${JSON.stringify(browserId)},'files']);select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
await host.eval("[...document.querySelectorAll('.processing-inspector button')].find(b=>b.textContent==='Save Changes').click()");
await until(()=>host.eval("document.querySelector('.processing-inspector')?.textContent.includes('Changes saved.')"),'Backend save failed');
assert.equal(workflow.nodes[1].type,'TRANSFORM');assert.equal(workflow.nodes[1].config.status,'ready');assert.equal(workflow.nodes[1].config.executor,'local');
assert.equal(workflow.nodes[1].config.dataProcessing.inputs.files.nodeId,browserId);
await host.eval('location.reload()');
await until(()=>host.eval(`!!document.querySelector('.node-${logicId}')`),'Reload failed');
await host.eval(`document.querySelector('.node-${logicId}').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }))`);
await until(()=>host.eval("!!document.querySelector('[aria-label=\"Input files\"]')"),'Inspector reload failed');
assert.equal(await host.eval(`document.querySelector('[aria-label="Input files"]').value`),JSON.stringify([browserId,'files']));
assert.equal(await host.eval("!!document.querySelector('dialog .recording-button')"),false);
const screenshot=await host.call('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/ghost-data-processing-inspector.png',Buffer.from(screenshot.data,'base64'));
await host.eval("document.querySelector('dialog button[aria-label=\"Close dialog\"]').click()");
await host.eval(`document.querySelector('.node-${browserId}').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }))`);
await until(()=>host.eval("!!document.querySelector('dialog .recording-button')"),'Browser recording controls lost');
await host.eval("document.querySelector('dialog button[aria-label=\"Close dialog\"]').click()");
await host.eval(`document.querySelector('.node-${logicId}').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }))`);
await host.eval("document.querySelector('dialog button[aria-label=\"Close dialog\"]').click()");
await host.eval("document.querySelector('button[aria-label=\"Add to workflow\"]').click()");
await until(()=>host.eval("!!document.querySelector('.canvas-add-menu:popover-open')"),'Add menu missing');
await host.eval("[...document.querySelectorAll('.canvas-add-menu button')].find(b=>b.textContent==='Add node').click()");
await host.eval("[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Data Processing node').click()");
await until(()=>host.eval("!!document.querySelector('.processing-inspector')"),'Added node missing');
await host.eval("[...document.querySelectorAll('.runtime-logic button')].find(b=>b.textContent==='Configure operations manually').click()");
await host.eval("(()=>{const select=document.querySelector('[aria-label=\"Processing operation\"]');select.value='generate_report';select.dispatchEvent(new Event('change',{bubbles:true}))})()");
await host.eval(`(()=>{const select=document.querySelector('[aria-label="Input rows"]');select.value=JSON.stringify([${JSON.stringify(logicId)},'rows']);select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
await host.eval("[...document.querySelectorAll('.processing-inspector button')].find(b=>b.textContent==='Save Changes').click()");
await until(()=>host.eval("document.querySelector('.processing-inspector')?.textContent.includes('Changes saved.')"),'Added node save failed');
assert.equal(workflow.nodes.length,3);assert.equal(workflow.edges.length,2);assert.equal(workflow.nodes[2].type,'OUTPUT');assert.equal(workflow.nodes[2].config.dataProcessing.inputs.rows.nodeId,logicId);
console.log('PASS backend-backed editor: save/reload typed configuration, no processing recorder, preserved browser recorder, adding and connecting output nodes');
} catch(error){console.error(error);process.exitCode=1}
finally {clearTimeout(watchdog);host?.close();electron.kill('SIGTERM');server.closeAllConnections();server.close()}
