import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const debug=9271;
const id='40000000-0000-4000-8000-000000000000', browserId='40000000-0000-4000-8000-000000000001', logicId='40000000-0000-4000-8000-000000000002';
const row={name:'rows',type:'array',itemType:'object',description:'Exported request rows',required:true,fields:[{name:'id',type:'string',description:'Request ID',required:true},{name:'status',type:'string',description:'Request status',required:true}]};
const output={inputs:[],outputs:[row],validationCriteria:['Every row has an ID'],requiresHumanReview:false};
const filter={inputs:[{...row,sourceStepId:browserId,sourceOutput:'rows'}],outputs:[{...row,name:'filteredRows'}],validationCriteria:['Only open requests remain'],requiresHumanReview:true};
let definitions=0;
let workflow={id,name:'Contract UI test',description:'Filter requests',status:'DRAFT',updatedAt:new Date().toISOString(),nodes:[
{id:browserId,type:'ACTION',label:'Export requests',positionX:80,positionY:100,config:{stepType:'browser',status:'needs_recording',description:'Export requests',instructions:[]}},
{id:logicId,type:'ACTION',label:'Filter requests',positionX:370,positionY:100,config:{stepType:'application',status:'needs_configuration',description:'Keep open requests',instructions:[]}},
],edges:[{id:'50000000-0000-4000-8000-000000000001',sourceNodeId:browserId,targetNodeId:logicId}]};
const server=http.createServer(async(req,res)=>{
res.setHeader('Content-Type','application/json');
if(req.url===`/api/workflows/${id}/contracts`){definitions++;workflow.nodes[0].config.contract=output;workflow.nodes[1].config.contract=filter;workflow.nodes[1].config.stepType='logic';workflow.nodes[1].type='TRANSFORM';}
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
await until(()=>host.eval('!!window.ghost?.defineWorkflowContracts'),'Contract preload missing');
await host.eval(`location.hash='/workflows/${id}'`);
await until(()=>host.eval("[...document.querySelectorAll('button')].some(b=>b.textContent==='Define inputs & outputs')"),'Definition button missing');
await host.eval("[...document.querySelectorAll('button')].find(b=>b.textContent==='Define inputs & outputs').click()");
await until(()=>host.eval("document.body.textContent.includes('Inputs, outputs and validation saved')"),'Definitions not saved');
assert.equal(definitions,1);
await host.eval(`document.querySelector('.node-${logicId}').click()`);
await until(()=>host.eval("!!document.querySelector('.node-data-contract')"),'Contract inspector missing');
assert.equal(await host.eval("document.querySelector('dialog').textContent.includes('Export requests → rows')"),true);
assert.equal(await host.eval("document.querySelector('dialog').textContent.includes('filteredRows')"),true);
assert.equal(await host.eval("document.querySelector('dialog').textContent.includes('Only open requests remain')"),true);
assert.equal(await host.eval("document.querySelector('dialog').textContent.includes('Human review required')"),true);
assert.equal(await host.eval("document.querySelector('dialog .recording-button')===null"),true);
await host.eval('location.reload()');
await until(()=>host.eval(`!!document.querySelector('.node-${logicId}')`),'Reload failed');
await host.eval(`document.querySelector('.node-${logicId}').click()`);
await until(()=>host.eval("document.querySelector('dialog')?.textContent.includes('filteredRows')"),'Definitions lost after reload');
console.log('PASS editor: define contracts, inspect source bindings/output fields/validation/review, no recording button on logic nodes, reload persisted definitions');
} catch(error){console.error(error);process.exitCode=1}
finally {clearTimeout(watchdog);host?.close();electron.kill('SIGTERM');server.closeAllConnections();server.close()}
