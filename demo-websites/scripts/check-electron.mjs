import electronPath from 'electron';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
const debug=Number(process.env.GHOST_FIXTURE_DEBUG_PORT || 9246);
const profile=await mkdtemp(join(tmpdir(),'ghost-reliability-'));
const electron=spawn(electronPath,['.','--ozone-platform=x11',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`],{stdio:['ignore','ignore','pipe']});
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
await until(()=>host.eval(`!!window.__state?.sessionId`),'Recording route not ready');
const token=await host.eval('window.__state.sessionId');
const initialBounds = await host.eval(`(()=>{const r=document.querySelector('.browser-viewport').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,visible:true}})()`);
await api('open',token,'about:blank',initialBounds);
await until(()=>host.eval(`window.__state?.url==='about:blank' && !window.__state.error`),'Empty teaching tab failed');
await api('recordingControl',token,'pause');
await api('navigate',token,'http://127.0.0.1:3100/finance');
await until(async()=>{const p=(await pages()).find(p=>p.url.includes(':3100'));if(!p)return false;guest=await connect(p);return true},'Fixture missing');
await until(()=>guest.eval(`!!document.querySelector('#login-email')`),'Login redirect missing');
await guest.call('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
await writeFile('/tmp/forma-login.png',Buffer.from((await guest.call('Page.captureScreenshot')).data,'base64'));
assert.equal(await guest.eval('document.documentElement.dataset.theme'),'dark');
await nativeClick('[data-testid=theme-toggle]');
assert.equal(await guest.eval('document.documentElement.dataset.theme'),'light');
await guest.eval('location.reload()');
await until(()=>guest.eval(`!!document.querySelector('#login-email') && document.documentElement.dataset.theme==='light'`),'Theme did not persist');
await nativeClick('[data-testid=theme-toggle]');
assert.equal(await guest.eval('document.documentElement.dataset.theme'),'dark');
await type('#login-email','demo@forma.test');await type('#login-password','ghost-demo');await nativeClick('[data-testid=login-submit]');
await until(()=>guest.eval(`!!document.querySelector('[data-testid=reset-demo]')`),'Login failed');
await nativeClick('[data-testid=reset-demo]');
await writeFile('/tmp/forma-finance.png',Buffer.from((await guest.call('Page.captureScreenshot')).data,'base64'));
await api('recordingControl',token,'resume');
await nativeClick('[data-testid=review-INV-2046]');
await until(()=>guest.eval(`!!document.querySelector('dialog[open]')`),'Invoice dialog did not open');
await nativeClick('[data-testid=mark-paid]');
await until(()=>guest.eval(`document.querySelector('[data-testid=mark-paid]').disabled`),'Payment update failed');
await nativeClick('[aria-label="Close invoice"]');
await until(()=>guest.eval(`document.querySelector('[data-testid=payment-INV-2046]').textContent.includes('Paid')`),'Payment not reflected in table');
await guest.eval(`location.href='/users'`);
await until(()=>guest.eval(`!!document.querySelector('[data-testid=add-customer]')`),'Users missing');
await writeFile('/tmp/forma-users.png',Buffer.from((await guest.call('Page.captureScreenshot')).data,'base64'));
await nativeClick('[data-testid=add-customer]');await type('#customer-name','Recorder Test');await type('#customer-email','recorder@example.test');await type('#customer-company','Recorder Studio');
await nativeClick('[data-testid=save-customer]');
await until(()=>guest.eval(`!document.querySelector('dialog[open]') && document.body.textContent.includes('Recorder Test')`),'Customer did not save');
await nativeClick('[aria-label="Pause recorder@example.test"]');
await until(()=>guest.eval(`!!document.querySelector('[aria-label="Activate recorder@example.test"]')`),'Pause failed');
await type('#record-search','recorder@example.test');
await until(()=>guest.eval(`document.querySelectorAll('tbody tr').length===1`),'Search failed');
await api('recordingControl',token,'stop');
const recording=JSON.parse(await api('recordingExport',token));
await writeFile(join(profile,'forma-recording.json'),JSON.stringify(recording,null,2));
assert.ok(!JSON.stringify(recording).includes('ghost-demo'),'Password must not be recorded');
assert.ok(JSON.stringify(recording).includes('recorder@example.test'),'Input capture missing');
assert.ok(JSON.stringify(recording).includes('mark-paid'),'Invoice click capture missing');
await guest.eval('location.reload()');
await until(()=>guest.eval(`!!document.querySelector('[aria-label="Activate recorder@example.test"]')`),'Customer state did not persist');
await guest.eval(`location.href='/finance'`);
await until(()=>guest.eval(`document.querySelector('[data-testid=payment-INV-2046]')?.textContent.includes('Paid')`),'Payment state did not persist');
for (const route of ['finance','users']) {
 await guest.eval(`location.href='/${route}'`);
 await until(()=>guest.eval(`location.pathname==='/${route}' && document.querySelector('h1')?.textContent.includes('${route==='finance'?'Finance overview':'Customers & users'}')`),'Responsive route not ready');
 for (const width of [360,768,1024,1440]) {
  await guest.call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  assert.equal(await guest.eval('document.documentElement.scrollWidth <= innerWidth'),true,'Horizontal page overflow '+route+' '+width);
  assert.equal(await guest.eval(`getComputedStyle(document.querySelector('[data-testid=sign-out]').parentElement).display!=='none'`),true,'Sign out hidden '+width);
  if(width===360)await writeFile('/tmp/forma-'+route+'-mobile.png',Buffer.from((await guest.call('Page.captureScreenshot')).data,'base64'));
 }
}
await guest.eval("document.querySelector('[data-testid=sign-out]').click()");
await until(()=>guest.eval(`!!document.querySelector('#login-email')`),'Sign out failed');
console.log('PASS: protected routes, native login, payment dialog/update, customer creation/pause/search, persisted state, sign out, actual Ghost event capture and password exclusion. Responsive widths 360/768/1024/1440 passed. Full replay/download verification not performed. Screenshots: /tmp/forma-{login,finance,users}.png');
} catch(error){console.error(error);process.exitCode=1}
finally{clearTimeout(watchdog);guest?.close();host?.close();electron.kill('SIGTERM')}
