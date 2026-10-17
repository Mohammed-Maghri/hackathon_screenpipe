// Run after launching Electron with: node_modules/.bin/electron . --remote-debugging-port=9224
// Uses a local fixture website and verifies the native browser through CDP.
import fs from 'node:fs/promises';
import http from 'node:http';
const server = http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(`<html><head><title>Fixture ${req.url}</title></head><body><h1>Teaching browser ${req.url}</h1><a href="/two">Next page</a><input placeholder="Try typing"><p>Native browser navigation fixture</p></body></html>`)});await new Promise(r=>server.listen(9335,'127.0.0.1',r));
const targets=await(await fetch('http://127.0.0.1:9224/json')).json();const host=targets.find(t=>t.url.includes('index.html'));
const ws=new WebSocket(host.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const pending=new Map();ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(d.error):p.resolve(d.result)}};
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(expression){for(let i=0;i<60;i++){if(await evaluate(expression))return;await pause(100)}throw Error('Timed out: '+expression)}
function assert(v,m){if(!v)throw Error(m)}
try {
await call('Page.reload',{ignoreCache:true});await pause(600);
await evaluate(`location.hash='/workflows/orders'`);await until(`!!document.querySelector('.node-slack')`);
const badge=await evaluate(`(() => {const r=document.querySelector('.node-slack .needs-attention').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2} })()`);await call('Input.dispatchMouseEvent',{type:'mousePressed',...badge,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...badge,button:'left',clickCount:1});assert(await evaluate(`document.querySelector('.node-slack').getAttribute('aria-pressed')==='true' && !document.querySelector('dialog[open]') && !!document.querySelector('.workflow-canvas')`),'A badge click should only select its node');
await call('Input.dispatchMouseEvent',{type:'mousePressed',...badge,button:'left',clickCount:2});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...badge,button:'left',clickCount:2});
await until(`!!document.querySelector('dialog[open] [aria-label="Node inspector"]')`);
await evaluate(`[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent.includes('Start recording')).click()`);
await until(`!!document.querySelector('.record-shell')`);
await until(`!document.querySelector('[aria-label="Website address"]').disabled`);
assert(await evaluate(`!!window.ghost.browser`),'No browser bridge');
await evaluate(`window.__browserEvents=[];window.__off=window.ghost.browser.onState(s=>window.__browserEvents.push(s)); window.__addressInput=document.querySelector('[aria-label="Website address"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(window.__addressInput,'http://127.0.0.1:9335/one');window.__addressInput.dispatchEvent(new Event('input',{bubbles:true}));`);
await pause(80);await evaluate(`document.querySelector('.browser-address').requestSubmit()`);
await until(`document.querySelector('.browser-tab').textContent.includes('Fixture /one') && !document.querySelector('.browser-loading-bar.is-loading')`);
const guests=await(await fetch('http://127.0.0.1:9224/json')).json();const guest=guests.find(t=>t.url==='http://127.0.0.1:9335/one');assert(guest,'Native webContents target absent');
const gws=new WebSocket(guest.webSocketDebuggerUrl);await new Promise(r=>gws.onopen=r);let gid=0;const gp=new Map();gws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){gp.get(d.id)(d);gp.delete(d.id)}};
function guestCall(method,params={}){return new Promise(r=>{const id=++gid;gp.set(id,r);gws.send(JSON.stringify({id,method,params}))})}
const security=await guestCall('Runtime.evaluate',{expression:`({node:typeof require,bridge:typeof window.ghost,width:innerWidth,height:innerHeight})`,returnByValue:true});assert(security.result.result.value.node==='undefined'&&security.result.result.value.bridge==='undefined','Remote page received privileged access');
console.log('Native viewport',security.result.result.value);
const linkBox=await guestCall('Runtime.evaluate',{expression:`(() => { const r=document.querySelector('a').getBoundingClientRect();return {x:r.x+10,y:r.y+5} })()`,returnByValue:true});const point=linkBox.result.result.value;await guestCall('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await guestCall('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});await until(`document.querySelector('.browser-tab').textContent.includes('Fixture /two')`);
await until(`!document.querySelector('[aria-label="Browser back"]').disabled && !document.querySelector('.browser-loading-bar.is-loading')`);await evaluate(`document.querySelector('[aria-label="Browser back"]').click()`);await until(`document.querySelector('.browser-tab').textContent.includes('Fixture /one')`);
await until(`!document.querySelector('[aria-label="Browser forward"]').disabled`);await evaluate(`document.querySelector('[aria-label="Browser forward"]').click()`);await until(`document.querySelector('.browser-tab').textContent.includes('Fixture /two')`);
await evaluate(`document.querySelector('[aria-label="Reload page"]').click()`);await until(`!document.querySelector('.browser-loading-bar.is-loading')`);
assert(await evaluate(`window.__browserEvents.some(s=>s.loading)`),'No loading state observed');
const denied=await evaluate(`window.ghost.browser.navigate(window.__browserEvents.at(-1).sessionId,'file:///etc/passwd').then(()=>false,()=>true)`);assert(denied,'Unsafe URL allowed');
await evaluate(`document.querySelector('[aria-label="Expand browser viewport"]').click()`);await pause(250);
await pause(1000);const wide=await guestCall('Runtime.evaluate',{expression:'innerWidth',returnByValue:true});console.log('Wide native',wide.result.result.value);assert(wide.result.result.value>security.result.result.value.width,'Native viewport did not resize');
await evaluate(`document.querySelector('[aria-label="Expand browser viewport"]').click()`);await pause(150);
await fs.writeFile('/tmp/ghost-recording-page.png',Buffer.from((await call('Page.captureScreenshot')).data,'base64'));
await evaluate(`Array.from(document.querySelectorAll('.record-header-actions button')).find(b=>b.textContent.includes('Need help')).click()`);await until(`!!document.querySelector('dialog[open]')`);await evaluate(`document.querySelector('.dialog-close').click()`);
await evaluate(`Array.from(document.querySelectorAll('.record-events footer button')).find(b=>b.textContent.includes('Pause')).click()`);await pause(100);
const count=await evaluate(`document.querySelectorAll('.record-event-scroll li').length`);await guestCall('Runtime.evaluate',{expression:`location.href='/paused'`});await until(`document.querySelector('.browser-tab').textContent.includes('Fixture /paused')`);assert(await evaluate(`document.querySelectorAll('.record-event-scroll li').length`)===count,'Paused session captured events');
await evaluate(`document.querySelector('.stop-recording').click()`);await until(`document.querySelector('.record-events').textContent.includes('Export session')`);
await evaluate(`Array.from(document.querySelectorAll('.record-header-actions button')).find(b=>b.textContent.includes('Exit')).click()`);await until(`!!document.querySelector('.editor-shell')`);await pause(300);
const after=await(await fetch('http://127.0.0.1:9224/json')).json();assert(!after.some(t=>t.id===guest.id),'Native webContents leaked after exit');
console.log('PASS: node selection, double-click inspector and explicit recording; native WebContentsView; real links; URL entry; back/forward/reload; loading state; restricted remote renderer; blocked file URL; viewport resize; help dialog; pause/stop; exit cleanup.');gws.close();
} catch(error) { console.log(await evaluate(`document.body.innerText`)); throw error } finally { ws.close();server.close(); }
