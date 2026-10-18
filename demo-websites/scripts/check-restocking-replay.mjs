import ExcelJS from 'exceljs';
import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
const debug=9259;
const base=process.env.NOVA_URL||'http://127.0.0.1:3104';
const profile=await mkdtemp(join(tmpdir(),'ghost-reliability-'));
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
await host.eval(`window.__state=null;window.__replay=null;window.__events=[];window.ghost.browser.onState(s=>window.__state=s);window.ghost.browser.onReplay(s=>window.__replay=s.status);window.ghost.browser.onRecorded(s=>window.__events.push(s.event));`);
async function api(method,...args){return host.eval(`window.ghost.browser[${JSON.stringify(method)}](...${JSON.stringify(args)})`)}
async function nativeClick(selector){const point=await guest.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('No element');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
async function type(selector,text){await nativeClick(selector);await guest.call('Input.insertText',{text});await until(()=>guest.eval(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(text)} || document.querySelector(${JSON.stringify(selector)}).innerText===${JSON.stringify(text)}`),'Native typing did not reach field');}
await host.eval(`location.hash='/workflows/orders/record/slack'`);
await until(()=>host.eval(`!!window.__state?.sessionId`),'Teaching route missing');
const token=await host.eval('window.__state.sessionId');

await api('recordingControl',token,'pause');
await api('navigate',token,base+'/nova/login');
await until(async()=>{const p=(await pages()).find(p=>p.url.startsWith(base));if(!p)return false;guest=await connect(p);return true},'NOVA missing');
await until(()=>guest.eval("!!document.querySelector('#nova-email')"),'Login missing');
await type('#nova-email','alex@nova.test');await type('#nova-password','nova-demo');await nativeClick('[data-testid=nova-login-submit]');
await until(()=>guest.eval("!!document.querySelector('.nova-content')"),'Login failed');
await api('navigate',token,base+'/nova/restocking');
await until(()=>guest.eval("!!document.querySelector('[data-testid=restock-demo-stock]')"),'Restocking page missing');
if(await guest.eval("!!document.querySelector('.nova-sample-data summary')"))await nativeClick('.nova-sample-data summary');
await nativeClick('[data-testid=restock-demo-stock]');
await until(()=>guest.eval("document.querySelector('#restock-hoodie-stock')?.value==='1'"),'Demo stock missing');
const bounds=(await api('diagnostics',token)).bounds;
guest.close();guest=null;
await api('open',token,base+'/nova/restocking',{...bounds,visible:true},true);
await until(async()=>{const p=(await pages()).find(p=>p.url.startsWith(base));if(!p)return false;guest=await connect(p);return true},'Fresh recording missing');
await until(()=>guest.eval("!!document.querySelector('[data-testid=restock-sales-export]')"),'Exports missing');
await until(async()=> (await api('diagnostics',token)).captureReady,'Recorder missing');
for(const [index,selector] of ['[data-testid=restock-sales-export]','[data-testid=restock-inventory-export]','[data-testid=restock-excel]'].entries()){
 await nativeClick(selector);
 await until(async()=>JSON.parse(await api('recordingExport',token)).events.filter(e=>e.type==='download-done'&&e.data.state==='completed').length===index+1,'Download not captured');
}
await api('recordingControl',token,'stop');
const plan=await api('replayPreview',token);assert.deepEqual(plan.blockers,[],JSON.stringify(plan.blockers));
for(let run=0;run<2;run++){
 if(run===1){
  await guest.eval("document.querySelector('#restock-hoodie-stock').focus()");
  await guest.call('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
  await guest.call('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
  await guest.call('Input.insertText',{text:'100'});
  await nativeClick('[data-testid=restock-save]');
  await until(()=>guest.eval("document.querySelector('[data-testid=restock-buy-hoodie]').textContent==='0'"),'Inventory change failed');
 }
 await host.eval('window.__replay=null');
 await api('replayStart',token,true,false,process.env.GHOST_DEMO==='1'?'demo':'fast');
 await until(async()=>{const r=await host.eval('window.__replay');return r&&['completed','failed','unknown','cancelled'].includes(r.state)},'Replay timed out',70000);
 const result=await host.eval('window.__replay');
 assert.equal(result.state,'completed',JSON.stringify(result));
 assert.equal(result.artifacts.length,3);assert.ok(result.artifacts.every(a=>a.state==='completed'));
 const excel=result.artifacts.find(a=>a.filename==='nova-shopping-list.xlsx');
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(excel.path);
 const quantity=workbook.getWorksheet('Shopping list').getCell('J2').value;
 assert.ok(run===0?quantity>0:quantity===0);
 console.log('PASS Ghost recorded/replayed NOVA downloads',run+1,'Excel hoodie quantity:',quantity);
 console.log('Downloaded workbook:',excel.path);
 if(process.env.GHOST_DEMO==='1'){
  await until(()=>host.eval("!!document.querySelector('.run-summary')"),'Summary missing');
  await writeFile(join(profile,'restocking-run-'+(run+1)+'.png'),Buffer.from((await host.call('Page.captureScreenshot')).data,'base64'));
  console.log('Run screenshot:',join(profile,'restocking-run-'+(run+1)+'.png'));
  await pause(10000);
 }
 // Restore the native view if the renderer opened the run summary.
 await host.eval("[...document.querySelectorAll('.run-summary button')].find(b=>b.textContent==='Back to browser')?.click()");
}
console.log('PASS: capture → stop → preview → verified replay twice, three completed artifacts per run, changed stock reflected in fresh Excel.');
}catch(error){console.error(error);console.error(errors.slice(-1500));process.exitCode=1}
finally{clearTimeout(watchdog);guest?.close();host?.close();electron.kill('SIGTERM')}
