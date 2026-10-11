import http from 'node:http';
import fs from 'node:fs/promises';
const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<html><head><title>Recorder fixture</title></head><body style="height:2200px"><button id="save" data-testid="save-button">Save report</button><label>Name<input id="name"></label><label>Password<input id="password" type="password"></label><input id="check" type="checkbox"><div id="scroller" style="height:80px;overflow:auto"><div style="height:500px">Scroll me</div></div><a href="/next">Next</a></body></html>')});await new Promise(r=>server.listen(9336,'127.0.0.1',r));
async function connect(target){const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(d.error):p.resolve(d.result)}};return {ws,call(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))})}}}
const pages=()=>fetch('http://127.0.0.1:9225/json').then(r=>r.json());
const host=await connect((await pages()).find(p=>p.url.includes('index.html')));
const evaluate=async expression=>{const r=await host.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(expr){for(let i=0;i<80;i++){if(await evaluate(expr))return;await pause(100)}throw Error('Timed out '+expr)}
let guest;
try {
await evaluate(`location.hash='/workflows/orders/record/slack'`);await until(`!!document.querySelector('.browser-address') && !document.querySelector('[aria-label="Website address"]').disabled`);
await evaluate(`window.__off=window.ghost.browser.onState(s=>window.__state=s);window.__offEvents=window.ghost.browser.onRecorded(s=>window.__record=s);`);
await evaluate(`(() => {const input=document.querySelector('[aria-label="Website address"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'http://127.0.0.1:9336/');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(80);await evaluate(`document.querySelector('.browser-address').requestSubmit()`);await until(`window.__state?.title==='Recorder fixture' && !window.__state.loading`);
guest=await connect((await pages()).find(p=>p.url.includes('9336')));
async function click(selector){const r=await guest.call('Runtime.evaluate',{expression:`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,returnByValue:true});const point=r.result.value;await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1})}
await click('#save');await click('#name');await guest.call('Input.insertText',{text:'Daily orders report'});await click('#password');await guest.call('Input.insertText',{text:'DO-NOT-SAVE-THIS-SECRET'});await click('#check');
await guest.call('Input.dispatchMouseEvent',{type:'mouseWheel',x:400,y:400,deltaX:0,deltaY:300});await pause(250);
await until(`!!document.querySelector('.recorded-event-detail')`);await evaluate(`document.querySelector('.recorded-event-detail').click()`);await until(`!!document.querySelector('.recording-event-json')`);await evaluate(`document.querySelector('.dialog-close').click()`);
const token=await evaluate(`window.__state.sessionId`);const control=action=>evaluate(`window.ghost.browser.recordingControl(${JSON.stringify(token)},${JSON.stringify(action)})`);
const paused=await control('pause');await guest.call('Runtime.evaluate',{expression:'window.scrollTo(0,0)'});await pause(100);await click('#save');await pause(150);const afterPause=await evaluate(`window.ghost.browser.recordingStatus(${JSON.stringify(token)})`);if(afterPause.eventCount!==paused.eventCount)throw Error('Pause captured an action');
await control('resume');
for(let i=0;i<105;i++) await click('#save');
const stopped=await control('stop');
const json=await evaluate(`window.ghost.browser.recordingExport(${JSON.stringify(token)})`);const recording=JSON.parse(json);
if(json.includes('DO-NOT-SAVE-THIS-SECRET'))throw Error('Password leaked');
const clickEvent=recording.events.find(e=>e.type==='click'&&e.data.target.id==='save');if(!clickEvent?.data.pointer || !clickEvent.data.target.selector || !clickEvent.data.viewport || !clickEvent.data.target.rect)throw Error('Missing replay target metadata');
if(!recording.events.some(e=>e.type==='input'&&e.data.value==='Daily orders report'))throw Error('Text not captured');
if(!recording.events.some(e=>e.type==='input'&&e.data.value==='[REDACTED]'))throw Error('No masked sensitive event');
if(!recording.events.some(e=>e.type==='input'&&e.data.checked===true))throw Error('Checkbox not captured');
if(!recording.events.some(e=>e.type==='scroll'))throw Error('Scroll not captured');
if(recording.events.length<=300)throw Error('Export appears truncated');
await click('#save');await pause(100);const afterStop=await evaluate(`window.ghost.browser.recordingStatus(${JSON.stringify(token)})`);if(afterStop.eventCount!==stopped.eventCount)throw Error('Stopped session captured action');
const lines=(await fs.readFile(stopped.path+'/events.jsonl','utf8')).trim().split('\n');if(lines.length!==recording.events.length)throw Error('Saved file incomplete');
console.log('PASS:',recording.events.length,'events persisted; click coordinates/selectors/geometry; text, checkbox, scrolling; password redaction; pause/resume/stop; export beyond 300 events.');
console.log('Saved:',stopped.path);
await evaluate(`window.ghost.controlWindow('close')`);
} finally {guest?.ws.close();host.ws.close();server.close()}
