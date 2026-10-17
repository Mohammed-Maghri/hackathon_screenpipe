import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
const debug=9269;
const reports=[];
for(let i=0;i<2;i++){const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Transactions');sheet.addRow(['id','status','amount']);sheet.addRow(['ok-'+i,'completed',100+i]);sheet.addRow(['failed-'+i,'failed',25+i]);reports.push(Buffer.from(await book.xlsx.writeBuffer()))}
const server=http.createServer((req,res)=>{const index=['/export0','/export1'].indexOf(req.url);if(index>=0){res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="report-${index}.xlsx"`});res.end(reports[index]);return}res.setHeader('Content-Type','text/html');res.end('<html><body><h1>Download sample Excel reports</h1><a href="/export0" id="export">Export first</a><br/><a href="/export1" id="export1">Export second</a></body></html>')});
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
await host.eval(`location.hash='/workflows/orders/record/slack'`);
await until(()=>host.eval(`!!window.__state?.sessionId`),'Teaching route missing');
const token=await host.eval('window.__state.sessionId');
await api('navigate',token,stalledURL);
await until(async()=>{const p=(await pages()).find(p=>p.url.startsWith(stalledURL));if(!p)return false;guest=await connect(p);return true},'Export fixture missing');
await until(()=>guest.eval(`!!document.querySelector('#export')`),'Export button missing');
await until(async()=>(await api('diagnostics',token)).captureReady,'Recorder did not attach');
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
const node=(id,operation,inputs,rules={},output)=>({id,config:{stepType:'data_processing',dataProcessing:{version:1,operation,inputs,rules,...(output?{output}: {})}}});
const ref=(nodeId,output,type)=>({nodeId,output,type});
const graph={nodes:[{id:'slack',config:{stepType:'browser'}},node('merge','merge_files',{files:ref('slack','files','files')}),node('failed','filter_rows',{rows:ref('merge','rows','rows')},{predicates:[{column:'status',operator:'eq',value:'failed'}],mode:'all'}),node('report','generate_report',{rows:ref('failed','rows','rows')},{},{filename:'consolidated_report.xlsx'})],edges:[['slack','merge'],['merge','failed'],['failed','report']].map(([sourceNodeId,targetNodeId])=>({sourceNodeId,targetNodeId}))};
const results=await host.eval(`window.ghost.processing.run(${JSON.stringify({workflowId:'orders',graph})})`);
assert.deepEqual(results.map(r=>r.status),['VERIFIED','VERIFIED','VERIFIED'],JSON.stringify(results));
assert.equal(results[0].outputs.count.value,4);assert.equal(results[1].outputs.count.value,2);assert.equal(results[2].outputs.count.value,2);
const directory=join(profile,'processing',createHash('sha256').update('orders').digest('hex'));
const saved=JSON.parse(await readFile(join(directory,(await readdir(directory)).find(f=>f.endsWith('.json'))),'utf8'));
const generated=saved.artifacts.find(([id])=>id===results[2].outputs.files.value[0].id)[1];
const output=new ExcelJS.Workbook();await output.xlsx.readFile(generated.path);
assert.equal(output.worksheets[0].rowCount,3);
assert.deepEqual(output.worksheets[0].getRow(2).values,[,'failed-0','failed',25]);
assert.deepEqual(output.worksheets[0].getRow(3).values,[,'failed-1','failed',26]);
console.log('PASS actual Electron browser downloads → read/merge → failed transactions → verified Excel report (4 input rows, 2 failures, total 51)');
const invalid=structuredClone(graph);invalid.nodes[2].config.dataProcessing.rules={predicates:[],mode:'all'};
const failed=await host.eval(`window.ghost.processing.run(${JSON.stringify({workflowId:'orders',graph:invalid})})`);
assert.deepEqual(failed.map(r=>r.status),['VERIFIED','FAILED','SKIPPED']);
console.log('PASS invalid configuration fails and downstream report is skipped');
await host.eval(`location.hash='/workflows/orders'`);
await until(()=>host.eval(`!!document.querySelector('.canvas-node.node-dashboard')`),'Editor did not open');
await host.eval(`document.querySelector('.canvas-node.node-dashboard').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }))`);
await host.eval(`[...document.querySelectorAll('[aria-label="Node inspector"] button')].find(b=>b.textContent==='Details').click()`);
await host.eval(`(()=>{const select=[...document.querySelectorAll('.editor-field')].find(e=>e.textContent.startsWith('Step type')).querySelector('select');select.value='Data Processing';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
await until(()=>host.eval(`!!document.querySelector('.processing-inspector')`),'Processing inspector missing');
assert.equal(await host.eval(`[...document.querySelectorAll('.processing-inspector button')].some(b=>b.textContent.includes('recording'))`),false);
assert.equal(await host.eval(`[...document.querySelectorAll('.processing-inspector button')].find(b=>b.textContent==='Test Node').disabled`),true);
await host.eval(`(()=>{const select=document.querySelector('[aria-label="Input files"]');select.value=JSON.stringify(['slack','files']);select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
await host.eval(`[...document.querySelectorAll('.processing-inspector button')].find(b=>b.textContent==='Test Node').click()`);
await until(()=>host.eval(`document.querySelector('.processing-result')?.textContent.includes('VERIFIED')`),'Inspector test did not verify');
assert.ok(await host.eval(`document.querySelector('.processing-result').textContent.includes('4 rows')`));
await host.eval(`[...document.querySelectorAll('.processing-inspector button')].find(b=>b.textContent==='Save Changes').click()`);
await until(()=>host.eval(`document.querySelector('.processing-inspector').textContent.includes('Changes saved.')`),'Save failed');
console.log('PASS processing inspector: conversion, typed input mapping, validation, local Test Node results, Save Changes, no recording controls');
assert.ok(!/UnhandledPromiseRejection/.test(errors),errors);
}catch(error){console.error(error);process.exitCode=1}
finally{clearTimeout(watchdog);guest?.close();host?.close();electron.kill('SIGTERM');const stop=setTimeout(()=>electron.kill('SIGKILL'),1500);stop.unref();electron.once('exit',()=>clearTimeout(stop));server.closeAllConnections();server.close()}
