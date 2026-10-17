import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const debug=9279;
const jsonExport=process.env.GHOST_TEST_JSON==='1',reportName=jsonExport?'failed.json':'failed.xlsx';
const workflowId='80000000-0000-4000-8000-000000000001',browserId='80000000-0000-4000-8000-000000000002',logicId='80000000-0000-4000-8000-000000000003',nextId='80000000-0000-4000-8000-000000000004';
await mkdir('backend/node_modules/.cache',{recursive:true});
const fixturePath='backend/node_modules/.cache/runtime-fixture.mjs';
await build({entryPoints:['backend/tests/runtime-fixture.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:fixturePath});
const {startFixture}=await import('../'+fixturePath);
await rm(fixturePath);
const fixture=await startFixture({id:workflowId,name:'Runtime logic acceptance',description:'Actual report inspection',status:'DRAFT',nodes:[
{id:browserId,type:'ACTION',label:'Download reports',positionX:80,positionY:100,config:{stepType:'browser',description:'Download both reports',status:'needs_recording',instructions:[],outputCapture:{textSelector:'h1',tableSelector:'#summary',jsonSelector:'#json'}}},
{id:logicId,type:'TRANSFORM',label:'Failed transactions',positionX:400,positionY:100,config:{stepType:'data_processing',description:'Merge the reports and keep rows whose status equals failed. Export '+reportName+'.',status:'needs_configuration',instructions:[],dataProcessing:{version:1,mode:'generated',operation:'read_files',inputs:{reports:{nodeId:browserId,output:'files',type:'files'}},rules:{},expectedOutput:{format:jsonExport?'json':'xlsx',filename:reportName}}}},
{id:nextId,type:'TRANSFORM',label:'Total failures',positionX:720,positionY:100,config:{stepType:'data_processing',description:'Sum amounts',status:'ready',dataProcessing:{version:1,operation:'aggregate',inputs:{rows:{nodeId:logicId,output:'rows',type:'rows'}},rules:{groupBy:[],column:'amount',calculation:'sum'}}}}
],edges:[[browserId,logicId],[logicId,nextId]].map(([sourceNodeId,targetNodeId],i)=>({id:'90000000-0000-4000-8000-00000000000'+i,sourceNodeId,targetNodeId}))});
const reports=[];
for(let i=0;i<2;i++){const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Transactions');sheet.addRow(['id','status','amount']);sheet.addRow(['ok-'+i,'completed',100+i]);sheet.addRow(['failed-'+i,'failed',25+i]);reports.push(Buffer.from(await book.xlsx.writeBuffer()))}
const server=http.createServer((req,res)=>{const index=['/export0','/export1'].indexOf(req.url);if(index>=0){res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="report-${index}.xlsx"`});res.end(reports[index]);return}res.setHeader('Content-Type','text/html');res.end('<html><body><h1>Download sample Excel reports</h1><table id="summary"><tr><th>count</th></tr><tr><td>2</td></tr></table><script id="json" type="application/json">{"count":2}</script><a href="/export0" id="export">Export first</a><br/><a href="/export1" id="export1">Export second</a></body></html>')});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const stalledURL='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(join(tmpdir(),'ghost-reliability-'));
const electron=spawn(electronPath,['.',`--ozone-platform=${process.env.GHOST_TEST_PLATFORM || 'x11'}`,`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`],{env:{...process.env,GHOST_BACKEND_URL:fixture.url},stdio:['ignore','ignore','pipe']});
const watchdog=setTimeout(()=>{console.error('Fixture test timed out');electron.kill('SIGTERM');process.exit(1)},120000);
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
const waiting=await host.eval(`window.ghost.runtimeLogic.inspect('${workflowId}','${logicId}')`);assert.equal(waiting.status,'waiting_for_input');assert.equal(fixture.calls,0);
await host.eval(`location.hash='/workflows/${workflowId}/record/${browserId}'`);
await until(()=>host.eval(`!!window.__state?.sessionId`),'Teaching route missing');
const token=await host.eval('window.__state.sessionId');
await api('navigate',token,stalledURL);
await until(async()=>{const p=(await pages()).find(p=>p.url.startsWith(stalledURL));if(!p)return false;guest=await connect(p);return true},'Export fixture missing');
await until(()=>guest.eval(`!!document.querySelector('#export')`),'Export button missing');
await pause(1000);
await nativeClick('#export');
await pause(500);
await nativeClick('#export1');
await until(()=>host.eval(`window.__events.filter(e=>e.type==='download-done'&&e.data.state==='completed').length===2`),'Download completion not captured');
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
assert.equal(result.artifacts.length,2);
assert.equal(result.structuredOutputs.text.value,'Download sample Excel reports');
assert.deepEqual(result.structuredOutputs.table.value,[{count:'2'}]);assert.deepEqual(result.structuredOutputs.json.value,{count:2});
console.log('PASS verified browser downloads, extracted text, table and JSON outputs');
await host.eval(`location.hash='/workflows/${workflowId}'`);
await until(()=>host.eval(`!!document.querySelector('.node-${logicId}')`),'Board missing');
await host.eval(`document.querySelector('.node-${logicId}').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }))`);
await until(()=>host.eval(`!!document.querySelector('.runtime-logic')`),'Runtime inspector missing');
const click=label=>host.eval(`[...document.querySelectorAll('.runtime-logic button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
assert.equal(await host.eval(`[...document.querySelectorAll('.runtime-logic button')].some(b=>/Inspect actual|Generate Logic|Test Node|Approve/.test(b.textContent))`),false);
const objective='Merge both reports and keep only rows whose status equals failed. Export '+reportName+'.';
await host.eval(`(()=>{const e=document.querySelector('[aria-label="Processing objective"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(objective)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
await click('Save Changes');
await until(()=>host.eval(`document.querySelector('.runtime-logic')?.textContent.includes('Changes saved.')`),'Independent save failed');
assert.equal(fixture.workflow.nodes[1].config.description,objective);
assert.equal(fixture.calls,0);
await host.eval('location.reload()');
await until(()=>host.eval(`!!document.querySelector('.node-${logicId}')`),'Reload after save failed');
await host.eval(`document.querySelector('.node-${logicId}').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }))`);
await until(()=>host.eval(`!!document.querySelector('.runtime-logic')`),'Saved inspector did not reopen');
assert.equal(await host.eval(`document.querySelector('[aria-label="Processing objective"]').value`),objective);
const unapproved=await host.eval(`window.ghost.processing.run(${JSON.stringify({workflowId,graph:fixture.workflow,nodeId:logicId})})`);
assert.equal(unapproved[0].status,'FAILED');
fixture.holdGeneration();
await click('Run');
await until(()=>host.eval(`!!document.querySelector('.processing-progress[data-stage="generating"]')`),'Generation animation missing');
assert.equal(await host.eval(`getComputedStyle(document.querySelector('.processing-spinner')).animationName`),'processing-spin');
const animated=await host.call('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/ghost-processing-animation.png',Buffer.from(animated.data,'base64'));
await host.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
assert.equal(await host.eval(`getComputedStyle(document.querySelector('.processing-spinner')).animationName`),'none');
await host.call('Emulation.setEmulatedMedia',{features:[]});
fixture.releaseGeneration();
await until(()=>host.eval(`document.querySelector('.runtime-logic')?.textContent.includes('Done. Logic saved')`),'Single Run did not generate/test/save',40000);
assert.equal(fixture.calls,1);
assert.equal(fixture.workflow.nodes[1].config.dataProcessing.approvedPlan.version,1);
assert.ok(await host.eval(`document.querySelector('#logic-results')?.textContent.includes('2 rows')`));
const screenshot=await host.call('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/ghost-simple-processing.png',Buffer.from(screenshot.data,'base64'));
await click('Run');
await until(()=>host.eval(`document.querySelector('.runtime-logic')?.textContent.includes('Done. Used saved logic.')`),'Saved Run failed');
assert.equal(fixture.calls,1);
const results=await host.eval(`window.ghost.processing.run(${JSON.stringify({workflowId,graph:fixture.workflow})})`);
assert.deepEqual(results.map(r=>r.status),['VERIFIED','VERIFIED'],JSON.stringify(results));
assert.equal(results[0].outputs.count.value,2);assert.deepEqual(results[1].outputs.rows.value,[{result:51}]);assert.equal(fixture.calls,1);
const directory=join(profile,'processing',createHash('sha256').update(workflowId).digest('hex'));
let generated;
for(const name of await readdir(directory)){if(!name.endsWith('.json'))continue;const saved=JSON.parse(await readFile(join(directory,name),'utf8'));generated=saved.artifacts.find(([id])=>id===results[0].outputs.files.value[0].id)?.[1]??generated;}
assert.ok(generated);
if(jsonExport){
assert.deepEqual(JSON.parse(await readFile(generated.path,'utf8')),[{id:'failed-0',status:'failed',amount:25},{id:'failed-1',status:'failed',amount:26}]);
assert.ok(await host.eval(`document.querySelector('#logic-results').textContent.includes('Show failed.json in folder')`));
console.log('PASS actual JSON file contents, output folder control and downstream total 51');
}else{
const output=new ExcelJS.Workbook();await output.xlsx.readFile(generated.path);
assert.equal(output.worksheets[0].rowCount,3);assert.deepEqual(output.worksheets[0].getRow(2).values,[,'failed-0','failed',25]);assert.deepEqual(output.worksheets[0].getRow(3).values,[,'failed-1','failed',26]);
}
console.log('PASS single Run → generation → local test → saved logic → reused plan → downstream total 51; actual exported contents verified');
await host.eval('location.reload()');
await until(()=>host.eval(`!!document.querySelector('.node-${logicId}')`),'Reload failed');
await host.eval(`document.querySelector('.node-${logicId}').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }))`);
await until(()=>host.eval(`document.querySelector('.runtime-logic')?.textContent.includes('View script & runtime')`),'Approved plan not restored');
await click('View script & runtime');
assert.equal(await host.eval(`document.querySelector('#generated-script pre').textContent`),await readFile('src/main/dataProcessing/planExecutor.ts','utf8'));
assert.equal(await host.eval(`document.querySelector('#generated-script').textContent.includes('TypeScript, compiled to JavaScript') && document.querySelector('#generated-script').textContent.includes('without calling AI')`),true);
await host.eval(`(()=>{const select=document.querySelector('[aria-label="Processing source"]');select.value='plan';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);

assert.deepEqual(JSON.parse(await host.eval(`document.querySelector('#generated-script pre').textContent`)),fixture.workflow.nodes[1].config.dataProcessing.approvedPlan.plan);
assert.equal(await host.eval(`document.querySelector('#generated-script').textContent.includes('Copy source') && document.querySelector('#generated-script').textContent.includes('Download source')`),true);
await click('Hide script & runtime');
assert.equal(await host.eval(`!!document.querySelector('#generated-script')`),false);
await host.eval(`window.ghost.automation.run('${workflowId}')`);
assert.equal((await host.eval('window.ghost.automation.list()'))[0].result,'Completed');
const schedule={workflowId,nextRun:new Date(Date.now()+3600000).toISOString(),intervalMinutes:1440};
await host.eval(`window.ghost.automation.save(${JSON.stringify(schedule)})`);
assert.equal((await host.eval('window.ghost.automation.list()'))[0].nextRun,schedule.nextRun);
await host.eval(`window.ghost.automation.remove('${workflowId}')`);
assert.equal((await host.eval('window.ghost.automation.list()')).length,0);
console.log('PASS workflow-list runner reuses verified outputs; schedule IPC save/list/remove');
fixture.workflow.nodes[1].config.description='Changed objective';
const changed=await host.eval(`window.ghost.processing.run(${JSON.stringify({workflowId,graph:fixture.workflow})})`);
assert.deepEqual(changed.map(r=>r.status),['FAILED','SKIPPED']);assert.match(changed[0].error,/changed/);
console.log('PASS prompt Save Changes/reload, single Run generation/testing/saving, saved plan reopens; changed objective blocks reuse and downstream execution');
assert.ok(!/UnhandledPromiseRejection/.test(errors),errors);
}catch(error){console.error(error);process.exitCode=1}
finally{clearTimeout(watchdog);guest?.close();host?.close();electron.kill('SIGTERM');server.closeAllConnections();server.close();await fixture.close()}
