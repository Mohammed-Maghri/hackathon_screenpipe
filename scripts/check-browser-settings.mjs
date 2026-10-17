import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const debug=9275;
const id='40000000-0000-4000-8000-000000000000', browserId='40000000-0000-4000-8000-000000000001', logicId='40000000-0000-4000-8000-000000000002';
let workflow={id,name:'Contract UI test',description:'Filter requests',status:'DRAFT',updatedAt:new Date().toISOString(),nodes:[
{id:browserId,type:'ACTION',label:'Export requests',positionX:80,positionY:100,config:{stepType:'browser',status:'needs_recording',description:'Export requests',instructions:[]}},
{id:logicId,type:'ACTION',label:'Merge reports',positionX:370,positionY:100,config:{stepType:'data_processing',status:'needs_configuration',description:'Read exported reports locally.',instructions:[],dataProcessing:{version:1,operation:'merge_files',inputs:{},rules:{}}}},
],edges:[{id:'50000000-0000-4000-8000-000000000001',sourceNodeId:browserId,targetNodeId:logicId}]};
let workflowGate=null,releaseWorkflow;
const server=http.createServer(async(req,res)=>{
if(req.url.startsWith('/site/')){res.setHeader('Content-Type','text/html');res.end('<h1>'+req.url+'</h1><button id="action" onclick="this.textContent=String(Date.now())">Record action</button>');return}
if(req.method==='GET'&&req.url.includes('/workflows/'+id)&&workflowGate)await workflowGate;
res.setHeader('Content-Type','application/json');
if(req.method==='PATCH'){let body='';for await(const chunk of req)body+=chunk;workflow={...workflow,...JSON.parse(body)};}
res.end(JSON.stringify(workflow));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const site=`http://127.0.0.1:${server.address().port}`;
workflow.nodes[0].config.startUrl=site+'/site/original';
workflow.nodes[0].config.instructions=['Open '+site+'/site/original.', 'Keep this custom instruction'];
const profile=await mkdtemp(join(tmpdir(),'ghost-contract-ui-'));
const electron=spawn(electronPath,['.','--ozone-platform=x11',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`],{env:{...process.env,GHOST_BACKEND_URL:`http://127.0.0.1:${server.address().port}`},stdio:['ignore','ignore','pipe']});
const watchdog=setTimeout(()=>{electron.kill('SIGKILL');process.exit(1)},60000);
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
await host.eval(`window.__browser=null;window.ghost.browser.onState(s=>window.__browser=s)`);
await host.eval(`document.querySelector('.node-${browserId}').click()`);
await host.eval(`[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Start recording').click()`);
await until(()=>host.eval(`window.__browser?.url===${JSON.stringify(site+'/site/original')}&&!window.__browser.loading`),'Original URL not opened');
const guest=await connect((await pages()).find(p=>p.url===site+'/site/original'));
await pause(1000);
const point=await guest.eval(`(()=>{const r=document.querySelector('#action').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
await pause(300);
const sessionId=await host.eval('window.__browser.sessionId');
const beforeSettings=await host.eval(`window.ghost.browser.recordingStatus(${JSON.stringify(sessionId)})`);
assert.equal(beforeSettings.state,'recording');
// The shared title bar and either sidebar width must leave the guest aligned
// to its DOM viewport without replacing the running recording session.
for (let toggle = 0; toggle < 2; toggle++) {
 await host.eval(`document.querySelector('.sidebar-toolbar button').click()`);
 await until(async()=>{
  const native=await host.eval(`window.ghost.browser.diagnostics(${JSON.stringify(sessionId)})`);
  const viewport=await host.eval(`(()=>{const r=document.querySelector('.browser-viewport').getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}})()`);
  return native.visible && ['x','y','width','height'].every(key=>native.bounds[key]===viewport[key]);
 },'Guest bounds did not follow the sidebar and title bar');
 assert.equal(await host.eval('window.__browser.sessionId'),sessionId,'Sidebar collapse must preserve the native session');
 assert.equal((await host.eval(`window.ghost.browser.recordingStatus(${JSON.stringify(sessionId)})`)).id,beforeSettings.id,'Sidebar collapse must preserve recording');
}

await host.eval(`window.__recordingElement=document.querySelector('.record-shell');document.querySelector('[aria-label="Settings"]').click()`);
await until(()=>host.eval(`!!document.querySelector('.settings-shell:not(.invisible)')`),'Full-page Settings did not open');
assert.equal((await host.eval(`window.ghost.browser.diagnostics(${JSON.stringify(sessionId)})`)).visible,false,'Settings must occlude the native guest');
assert.equal((await host.eval(`window.ghost.browser.recordingStatus(${JSON.stringify(sessionId)})`)).state,'recording','Settings must not stop recording');
await host.eval(`document.querySelector('a[href="#/settings/appearance"]').click()`);
await host.eval(`document.querySelector('.settings-shell .appearance-selector button[value="dark"]').click()`);
assert.equal((await host.eval(`window.ghost.browser.diagnostics(${JSON.stringify(sessionId)})`)).visible,false,'Appearance changes must keep the guest occluded');
await host.eval(`document.querySelector('[aria-label="Back to app"]').click()`);
await until(()=>host.eval(`!document.querySelector('.settings-shell')&&location.hash==='#/workflows/${id}/record/${browserId}'`),'Settings did not return to the recorder');
assert.ok(await host.eval(`window.__recordingElement===document.querySelector('.record-shell')`),'Recorder must remain mounted across Settings');
assert.equal(await host.eval('window.__browser.sessionId'),sessionId,'Settings must preserve the native session');
const afterSettings=await host.eval(`window.ghost.browser.recordingStatus(${JSON.stringify(sessionId)})`);
assert.equal(afterSettings.state,'recording');
assert.equal(afterSettings.id,beforeSettings.id,'Settings must preserve the same recording');
await until(async()=> (await host.eval(`window.ghost.browser.diagnostics(${JSON.stringify(sessionId)})`)).visible,'Guest did not reattach after Settings');
await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
await until(async()=> (await host.eval(`window.ghost.browser.recordingStatus(${JSON.stringify(sessionId)})`)).eventCount>afterSettings.eventCount,'Recording did not capture actions after Settings');
await host.eval(`window.ghost.browser.recordingControl(window.__browser.sessionId,'stop')`);
guest.close();
await host.eval(`location.hash='/workflows/${id}'`);
await until(()=>host.eval(`!!document.querySelector('.node-${browserId}')`),'Board missing');
await host.eval(`document.querySelector('.node-${browserId}').click()`);
async function edit(selector,value){await host.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)}
await edit('[aria-label="Starting dashboard URL"]',site+'/site/changed');
await edit('[aria-label="Browser step name"]','Edited browser node');
await edit('[aria-label="Node description"]','Edited description');
assert.equal(await host.eval(`document.querySelector('[aria-label="Instruction 1"]').value`),'Open '+site+'/site/changed');
await until(()=>host.eval(`[...document.querySelectorAll('dialog button')].some(b=>b.textContent==='View saved recording')`),'Saved recording status did not load');
await host.eval(`window.__browser=null;[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='View saved recording').click()`);
await until(()=>host.eval(`window.__browser?.url===${JSON.stringify(site+'/site/changed')}&&!window.__browser.loading`),'Edited URL was overridden by saved recording');
assert.equal(workflow.nodes[0].config.startUrl,site+'/site/changed');
assert.equal(workflow.nodes[0].label,'Edited browser node');
assert.equal(workflow.nodes[0].config.description,'Edited description');
assert.equal(workflow.nodes[0].config.instructions[0],'Open '+site+'/site/changed');
assert.equal(workflow.nodes[0].config.instructions[1],'Keep this custom instruction');
assert.ok(await host.eval(`document.querySelector('.record-instructions')?.textContent.includes(${JSON.stringify('Open '+site+'/site/changed')})`));
assert.equal((await host.eval(`window.ghost.browser.recordingStatus(window.__browser.sessionId)`)).state,'stopped','Saved recording must be preserved');
await host.eval(`location.hash='/workflows/${id}'`);
await until(()=>host.eval(`!!document.querySelector('.node-${browserId}')`),'Board missing after reopen');
await host.eval('location.reload()');
await until(()=>host.eval(`!!document.querySelector('.node-${browserId}')`),'Reload missing');
await host.eval(`document.querySelector('.node-${browserId}').click()`);
assert.equal(await host.eval(`document.querySelector('[aria-label="Starting dashboard URL"]').value`),site+'/site/changed');
await edit('[aria-label="Starting dashboard URL"]',site+'/site/saved');
await host.eval(`[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Save Changes').click()`);
await until(()=>host.eval(`document.body.textContent.includes('Workflow saved to the backend.')`),'Inspector save failed');
assert.equal(workflow.nodes[0].config.startUrl,site+'/site/saved');
// A slow backend can finish mounting the recorder while Settings covers it.
workflowGate=new Promise(resolve=>{releaseWorkflow=resolve});
await host.eval(`window.__browser=null;location.hash='/workflows/${id}/record/${browserId}'`);
await until(()=>host.eval(`document.body.textContent.includes('Loading saved workflow…')`),'Delayed recorder did not show loading');
await host.eval(`document.querySelector('[aria-label="Settings"]').click()`);
await until(()=>host.eval(`!!document.querySelector('.settings-shell:not(.invisible)')`),'Settings did not open over loading recorder');
releaseWorkflow();workflowGate=null;
await until(()=>host.eval(`!!document.querySelector('[inert] .record-shell')`),'Delayed recorder did not mount behind Settings');
assert.equal(await host.eval('window.__browser'),null,'Native opening must wait until Settings is uncovered');
await host.eval(`document.querySelector('[aria-label="Back to app"]').click()`);
await until(()=>host.eval(`window.__browser?.url===${JSON.stringify(site+'/site/saved')}&&!window.__browser.loading`),'Delayed recorder did not open after Settings');
assert.equal((await host.eval(`window.ghost.browser.recordingStatus(window.__browser.sessionId)`)).state,'stopped','Deferred startup must restore the saved recording');
assert.equal((await host.eval(`window.ghost.browser.diagnostics(window.__browser.sessionId)`)).visible,true);
console.log('PASS browser settings: full-page Settings occludes the guest and preserves active recording/capture; delayed recorder opens after return; URL/name/description/instructions save and reload; restored recording respects edited URL');
} catch(error){console.error(error);process.exitCode=1}
finally {
clearTimeout(watchdog);host?.close();electron.kill('SIGTERM');server.closeAllConnections();server.close();
// macOS can retain the test's Electron process after its window has closed.
const shutdown=setTimeout(()=>electron.kill('SIGKILL'),2000);shutdown.unref();electron.once('exit',()=>clearTimeout(shutdown));
}
