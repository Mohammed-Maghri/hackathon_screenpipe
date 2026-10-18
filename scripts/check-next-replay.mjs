import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
const debug=9262;
const users=process.env.GHOST_DEMO_PAGE==='users';const desired=users?'Active':'Paid';
const stalledURL='http://127.0.0.1:3100';
const profile=await mkdtemp(join(tmpdir(),'ghost-reliability-'));
const electron=spawn(electronPath,['.',`--ozone-platform=${process.env.GHOST_TEST_PLATFORM || 'x11'}`,`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`],{stdio:['ignore','ignore','pipe']});
const watchdog=setTimeout(()=>{console.error('Fixture test timed out');electron.kill('SIGTERM');process.exit(1)},300000);
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
async function nativeClick(selector,button='left'){const point=await guest.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('No element');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button,clickCount:1});await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button,clickCount:1});}
async function type(selector,text){
 await nativeClick(selector);
 for(const character of text){
  await guest.call('Input.dispatchKeyEvent',{type:'keyDown',key:character,text:character});
  await guest.call('Input.dispatchKeyEvent',{type:'keyUp',key:character});
 }
 await until(()=>guest.eval(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(text)}`),'Physical keyboard typing did not reach field');
}

await host.eval(`location.hash='/workflows/orders/record/slack'`);
await until(()=>host.eval(`!!window.__state?.sessionId`),'Teaching route missing');
const token=await host.eval('window.__state.sessionId');
await api('navigate',token,stalledURL+'/login');
await until(async()=>{const p=(await pages()).find(p=>p.url.startsWith(stalledURL));if(!p)return false;guest=await connect(p);return true},'Login fixture missing');

await until(()=>guest.eval("!!document.querySelector('#login-email')"),'Next login missing');
await type('#login-email','demo@forma.test');
await guest.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
await guest.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
await until(()=>guest.eval("document.activeElement.id==='login-password'"),'Tab failed to reach password');

await type('#login-password','ghost-demo');
const background=await guest.eval("(()=>{const r=document.querySelector('form').getBoundingClientRect();const y=Math.max(5,Math.min(innerHeight-5,r.y+30));const x=Math.max(5,r.x-5);const hit=document.elementFromPoint(x,y);if(!hit || hit.closest('button,input,a,select'))throw Error('No visible background point');return{x,y}})()");
for(let i=0;i<2;i++){
 await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...background,button:'left',clickCount:1});
 await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',...background,button:'left',clickCount:1});
}

await nativeClick('[data-testid=login-submit]');
await until(()=>guest.eval("!!document.querySelector('#status-filter')"),'Next login failed');
if(users){await nativeClick('a[href="/users"]');await until(()=>guest.eval("location.pathname==='/users' && !!document.querySelector('#status-filter')"),'Users dashboard missing')}
await nativeClick('#status-filter','right');
await guest.eval("document.querySelector('#status-filter').focus()");
for(const [key,code,vk] of [['Home','Home',36],['ArrowDown','ArrowDown',40],['Enter','Enter',13]]) {
 await guest.call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk});
 await guest.call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk});
}
await until(()=>guest.eval(`document.querySelector('#status-filter').value===${JSON.stringify(desired)}`),'Filter not selected');
await nativeClick('[data-testid=export-table]');
await until(()=>host.eval("window.__events.some(e=>e.type==='download-done'&&e.data.state==='completed')"),'Recorded export did not complete');
await api('recordingControl',token,'stop');
const preview=await api('replayPreview',token);assert.deepEqual(preview.blockers,[]);
const record=JSON.parse(await api('recordingExport',token));
assert.ok(record.events.some(e=>e.type==='keydown'&&e.data.key==='Tab'),'Test must include actual Tab');
assert.ok(record.events.filter(e=>e.type==='input'&&e.data.encryptedValue).length>=10,'Test must capture incremental password typing');

assert.ok(!JSON.stringify(record).includes('ghost-demo'),'Password leaked');
console.log('Recorded actual Next.js login/filter/export',preview.steps,'actions');
guest.close();guest=null;
for(let run=1;run<=20;run++){
 await host.eval('window.__replay=null');
 await api('replayStart',token,true);
 await until(async()=>{
  const status=await host.eval('window.__replay');
  assert.notEqual(status?.state,'needs-user-approval','Run authorization should avoid repeated prompts');
  if(status?.state==='failed'||status?.state==='unknown')throw Error(JSON.stringify(status));
  return status?.state==='completed';
 },'Next.js replay timed out',45000);
 guest=await connect((await pages()).find(p=>p.url.startsWith(stalledURL)));
 assert.equal(await guest.eval("document.querySelector('#status-filter').value"),desired);
 assert.equal(await guest.eval("location.pathname"),users?'/users':'/finance');
 // Verify actual saved CSV data, independently of replay's status.
 const {readdir}=await import('node:fs/promises');
 const folder=(await api('recordingStatus',token)).path+'/downloads';
 const files=await readdir(folder);
 assert.equal(files.length,run+1);
 const csv=await readFile(join(folder,files[files.length-1]),'utf8');
 assert.ok(csv.includes(users?'Name':'Invoice'));assert.ok(csv.includes(desired));
 assert.ok(users?!csv.includes('Paused'):!csv.includes('Pending')&&!csv.includes('Overdue'));
 if(run%2===0)await guest.eval("localStorage.removeItem('forma-session')");
 guest.close();guest=null;
 console.log('PASS actual Next',users?'users':'finance','dashboard run',run);
}
await mkdir('out/test-results', { recursive: true });
await writeFile(`out/test-results/next-replay-${users?'users':'finance'}-results.json`,JSON.stringify({date:new Date().toISOString(),runs:20,successful:20,platform:process.env.GHOST_TEST_PLATFORM||'x11',scenario:'native typed login, Tab, encrypted password, background clicks, dropdown, CSV download'},null,2));
assert.ok(!/UnhandledPromiseRejection/.test(errors),errors);
console.log('PASS: encrypted password capture, secret-free export, blocker-free login preview and verified full login/task replay');
}catch(error){console.error(error);process.exitCode=1}
finally{clearTimeout(watchdog);guest?.close();host?.close();electron.kill('SIGTERM');}
