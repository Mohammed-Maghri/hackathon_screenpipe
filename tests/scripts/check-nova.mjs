import electronPath from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const root=await mkdtemp(join(tmpdir(),'nova-ui-'));
const base=process.env.NOVA_URL||'http://127.0.0.1:3102';
const port=9281;
if(process.env.NODE_USE_ENV_PROXY) process.env.NODE_USE_ENV_PROXY='0';
await writeFile(join(root,'main.cjs'),`const {app,BrowserWindow,session}=require('electron');app.whenReady().then(()=>{global.w=new BrowserWindow({width:1536,height:1080,webPreferences:{sandbox:true,contextIsolation:true}});session.defaultSession.on('will-download',(_e,item)=>item.setSavePath(${JSON.stringify(root)}+'/'+item.getFilename()));w.loadURL(${JSON.stringify(base+'/nova/login')});});`);
const child=spawn(electronPath,[join(root,'main.cjs'),`--ozone-platform=${process.env.GHOST_TEST_PLATFORM||'x11'}`,`--remote-debugging-port=${port}`,`--user-data-dir=${root}/profile`],{stdio:['ignore','ignore','pipe']});
let errors='';child.stderr.on('data',d=>errors+=d);child.on('exit',(code,signal)=>console.log('Browser exit',code,signal));let ws;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message){for(let i=0;i<300;i++){try{if(await fn())return}catch(e){if(i===299)console.error(String(e),e.cause?.code,e.cause?.message)}await sleep(50)}throw Error(message)}
try {
 let target;await until(async()=>{target=(await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json())).find(p=>p.webSocketDebuggerUrl && !p.url.startsWith('devtools:'));return target},'Browser startup');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();
 ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result)}}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value};
 const wait=expression=>until(()=>evaluate(expression),'Expected '+expression);
 async function click(selector){await wait(`!!document.querySelector(${JSON.stringify(selector)})`);await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});}
 async function type(selector,text){await click(selector);await call('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await call('Input.insertText',{text});}
 async function navigate(path){await call('Page.navigate',{url:base+path});await wait(`location.pathname===${JSON.stringify(path)}&&document.readyState==='complete'&&!!document.querySelector('.nova-content')`);}
 async function select(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);}
 await call('Emulation.setFocusEmulationEnabled',{enabled:true});await sleep(500);
 await type('#nova-email','alex@nova.test');await type('#nova-password','wrong');await click('[data-testid=nova-login-submit]');await wait("!!document.querySelector('[role=alert]')");
 await type('#nova-password','nova-demo');await click('[data-testid=nova-login-submit]');await wait("!!document.querySelector('.nova-metrics')");
 await evaluate("document.fonts.ready");await sleep(300);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 const screenshot=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(root,'nova-desktop.png'),Buffer.from(screenshot.data,'base64'));
 await navigate('/nova/orders');await select('#nova-status-filter','Paid');
 await click('[data-testid=nova-export]');await until(async()=>(await readdir(root)).includes('nova-orders.csv'),'CSV download');
 const csv=await readFile(join(root,'nova-orders.csv'),'utf8');assert.ok(csv.includes('Paid'));assert.ok(!csv.includes('Cancelled'));assert.ok(!csv.includes('Processing'));
 await click('[data-testid=order-10458]');await select('#nova-order-state','Shipped');await type('#nova-order-notes','Packed by Ghost');await click('[data-testid=nova-save-order]');await wait("document.querySelector('[role=status]')?.textContent.includes('updated successfully')");
 await navigate('/nova/orders');await click('[data-testid=order-10458]');await wait("document.querySelector('#nova-order-state').value==='Shipped'");assert.equal(await evaluate("document.querySelector('#nova-order-notes').value"),'Packed by Ghost');await click('[aria-label="Close details"]');
 await navigate('/nova/products');await click('[data-testid=edit-product-hoodie]');await type('#nova-product-stock','72');await click('[data-testid=nova-save-product]');await wait("document.querySelector('[role=status]')?.textContent.includes('Product saved')");await navigate('/nova/products');assert.ok(await evaluate("document.querySelector('.nova-catalog').textContent.includes('72 in stock')"));
 await navigate('/nova/marketing');await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Create campaign').click()");await type('#nova-campaign-name','Autumn launch');await evaluate("document.querySelector('dialog form').requestSubmit()");await wait("document.querySelector('.nova-campaigns').textContent.includes('Autumn launch')");
 await navigate('/nova/customers');assert.equal(await evaluate('document.querySelectorAll("tbody tr").length'),12);
 await navigate('/nova');await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await sleep(200);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Phone page overflows');await click('[aria-label="Toggle navigation"]');await wait("document.querySelector('.nova-sidebar').classList.contains('is-open')");await click('[aria-label="Toggle navigation"]');
 const mobile=await call('Page.captureScreenshot',{format:'png'});await writeFile(join(root,'nova-mobile.png'),Buffer.from(mobile.data,'base64'));
 console.log('PASS NOVA: login validation, dashboard, filtered CSV, order status/notes persistence, inventory persistence, campaign draft, customers, responsive layout.');console.log('Screenshots:',root);
}catch(error){console.error(errors.slice(-2500));throw error}finally{ws?.close();child.kill('SIGTERM');}
