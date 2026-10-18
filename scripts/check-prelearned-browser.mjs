import electronPath from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
const debug=9264;
const scenario=process.env.GHOST_TEACH_SCENARIO||'nova';
if(!['nova','forma'].includes(scenario))throw Error('Choose nova or forma');
const nova=scenario==='nova';
const base='https://hackathon-screenpipe.vercel.app';
const profile=process.env.GHOST_TEACH_PROFILE||await mkdtemp(join(tmpdir(),'ghost-hosted-teaching-'));
const bundle=await build({entryPoints:['src/renderer/src/data/demoDiscovery.ts'],bundle:true,write:false,format:'esm'});
const {demoWorkflow}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const prepared=demoWorkflow(scenario,nova?'Review NOVA sales and inventory and prepare a shopping list':'Review Forma payments and export the finance report');
const electron=spawn(electronPath,['.',`--ozone-platform=${process.env.GHOST_TEST_PLATFORM || 'x11'}`,`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`],{stdio:['ignore','ignore','pipe']});
const watchdog=setTimeout(()=>{console.error('Fixture test timed out');electron.kill('SIGTERM');process.exit(1)},180000);
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
await host.eval(`window.__state=null;window.__replay=null;window.__loginActions=[];window.__events=[];window.ghost.browser.onState(s=>window.__state=s);window.ghost.browser.onReplay(s=>{window.__replay=s.status;if(s.status.action?.startsWith('Login:'))window.__loginActions.push(s.status.action)});window.ghost.browser.onRecorded(s=>window.__events.push(s.event));`);
async function api(method,...args){return host.eval(`window.ghost.browser[${JSON.stringify(method)}](...${JSON.stringify(args)})`)}
async function nativeClick(selector){const point=await guest.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('No element');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
async function type(selector,text){await nativeClick(selector);await guest.call('Input.insertText',{text});await until(()=>guest.eval(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(text)} || document.querySelector(${JSON.stringify(selector)}).innerText===${JSON.stringify(text)}`),'Native typing did not reach field');}
const selected=await host.eval(`(()=>{const key='ghost.prepared-workflows.v1';const rows=JSON.parse(localStorage.getItem(key)||'[]');let workflow=rows.find(w=>w.nodes.some(n=>n.config.demoScenario===${JSON.stringify(scenario)}&&n.config.stepType==='browser'));if(!workflow){workflow={...${JSON.stringify(prepared)},id:crypto.randomUUID(),updatedAt:new Date().toISOString()};rows.unshift(workflow)}const node=workflow.nodes.find(n=>n.config.stepType==='browser');node.config.startUrl=${JSON.stringify(base+(nova?'/nova/restocking':'/finance'))};localStorage.setItem(key,JSON.stringify(rows));location.hash='/workflows/'+workflow.id+'/record/'+node.id;return{workflowId:workflow.id,nodeId:node.id}})()`);
await until(()=>host.eval(`!!window.__state?.sessionId`),'Teaching route missing');
const token=await host.eval('window.__state.sessionId');

await until(async()=>(await api('recordingStatus',token)).state==='stopped','Pre-taught recording was not installed');
const beforeRun=await api('learnedSteps',selected.workflowId,[selected.nodeId]);
assert.equal(beforeRun[0].status,'Learned');
const original=JSON.parse(await api('recordingExport',token));
assert.ok(original.events.some(e=>e.type==='click'));
assert.ok(original.events.filter(e=>e.type==='navigation').length>=2);
assert.ok(!original.events.some(e=>e.type==='input'),'Reusable template must contain no credentials');
const originalId=(await api('recordingStatus',token)).id;
await api('prepareHosted',selected.workflowId,[{id:selected.nodeId,url:base+(nova?'/nova/restocking':'/finance')}]);
assert.equal((await api('recordingStatus',token)).id, originalId);
const exports=Array(nova?3:1);const taskURL=base+(nova?'/nova/restocking':'/finance');
const plan=await api('replayPreview',token);assert.deepEqual(plan.blockers,[],JSON.stringify(plan.blockers));
await host.eval('window.__replay=null');
await api('replayStart',token,true,false,'fast');
await until(async()=>{const r=await host.eval('window.__replay');return r&&['completed','failed','unknown','cancelled'].includes(r.state)},'Replay timed out',70000);
const result=await host.eval('window.__replay');
assert.equal(result.state,'completed',JSON.stringify(result));
const loginActions=await host.eval('window.__loginActions');
for(const action of ['Opening login page','Entering email','Entering password','Clicking Sign in','Waiting for signed-in dashboard'])assert.ok(loginActions.includes('Login: '+action),action);
console.log('PASS: login page, email/password entry, native sign-in click and dashboard verification');
assert.equal(result.artifacts.length,exports.length);assert.ok(result.artifacts.every(a=>a.state==='completed'));
const learned=await host.eval(`window.ghost.browser.learnedSteps(${JSON.stringify(selected.workflowId)},[${JSON.stringify(selected.nodeId)}])`);
assert.equal(learned[0].status,'Learned');
await writeFile(join(profile,'hosted-teaching-'+scenario+'.json'),JSON.stringify({scenario,url:taskURL,...selected,recordingId:result.recordingId,state:result.state,artifacts:result.artifacts.map(a=>({filename:a.filename,path:a.path,state:a.state})),learned},null,2));
console.log('PASS: pre-taught '+scenario+' installed with no manual teaching, signed in and replay verified; '+exports.length+' downloads. Profile: '+profile);
console.log('Workflow: '+selected.workflowId+' node: '+selected.nodeId);
await api('close',token);
await host.eval(`location.hash='/workflows/${selected.workflowId}'`);
await until(()=>host.eval(`document.body.innerText.includes('Learned')`),'Board did not show Learned');
}catch(error){console.error(error);if(host)console.error(await host.eval('JSON.stringify({state:window.__state,loginActions:window.__loginActions,replay:window.__replay})').catch(()=>''));console.error(errors.slice(-1500));process.exitCode=1}
finally{clearTimeout(watchdog);guest?.close();host?.close();electron.kill('SIGTERM')}
