import http from 'node:http';
let omitSave = false; let omitCookie = false;
const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end((omitCookie ? '<style>#cookie{display:none}</style>' : '') + (omitSave ? '<style>#save{display:none}</style>' : '') + '<html><head><title>Replay fixture</title></head><body style="height:2200px"><script>window.saves=0</script><button id="cookie" onclick="this.remove()">Accept cookies</button><button id="save" onclick="window.saves++" data-testid="save-button">Save report</button><label>Name<input id="name"></label><label>Password<input id="password" type="password"></label><input id="check" type="checkbox"><div id="scroller" style="height:80px;overflow:auto"><div style="height:500px">Scroll me</div></div><a href="/next">Next</a></body></html>')});await new Promise(r=>server.listen(9338,'127.0.0.1',r));
async function connect(target){const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(d.error):p.resolve(d.result)}};return {ws,call(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))})}}}
const pages=()=>fetch('http://127.0.0.1:9225/json').then(r=>r.json());
const host=await connect((await pages()).find(p=>p.url.includes('index.html')));
const evaluate=async expression=>{const r=await host.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(expr){for(let i=0;i<250;i++){if(await evaluate(expr))return;await pause(100)}throw Error('Timed out '+expr)}
let guest;
try {
await evaluate(`location.hash='/workflows'`);await pause(300);await evaluate(`location.hash='/workflows/orders/record/slack'`);await until(`!!document.querySelector('.browser-address') && !document.querySelector('[aria-label="Website address"]').disabled`);
await evaluate(`window.__off=window.ghost.browser.onState(s=>window.__state=s);window.__offEvents=window.ghost.browser.onRecorded(s=>window.__record=s);`);
await evaluate(`(() => {const input=document.querySelector('[aria-label="Website address"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'http://127.0.0.1:9338/');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(80);await evaluate(`document.querySelector('.browser-address').requestSubmit()`);await until(`window.__state?.title==='Replay fixture' && !window.__state.loading`);
guest=await connect((await pages()).find(p=>p.url.includes('9338')));
async function click(selector){const r=await guest.call('Runtime.evaluate',{expression:`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,returnByValue:true});const point=r.result.value;await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});await pause(150)}
await click('#cookie');await click('#name');await guest.call('Input.insertText',{text:'Daily orders report'});await pause(150);await click('#check');await click('#save');await pause(250);
await evaluate(`document.querySelector('.stop-recording').click()`);await until(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Test recording')`);
await evaluate(`window.__replayOff=window.ghost.browser.onReplay(v=>window.__replay=v.status)`);
await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Test recording').click()`);await until(`!!document.querySelector('dialog[open]')`);
await evaluate(`(() => { const input=document.querySelector('.saved-replay-input input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Saved replacement');input.dispatchEvent(new Event('input',{bubbles:true})); })()`);await pause(100);
await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Save inputs').click()`);await until(`document.body.innerText.includes('Inputs saved locally.')`);
// The consent choice persists: subsequent page loads have no banner.
omitCookie=true;
await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Start test').click()`);
await until(`window.__replay && window.__replay.state!=='running'`);
const status=await evaluate('window.__replay');if(status.state!=='completed')throw Error(JSON.stringify(status));
const result=await guest.call('Runtime.evaluate',{expression:`({name:document.querySelector('#name').value,checked:document.querySelector('#check').checked,saves:window.saves})`,returnByValue:true});
if(result.result.value.name!=='Saved replacement'||!result.result.value.checked||result.result.value.saves!==1)throw Error(JSON.stringify(result));
const token=await evaluate('window.__state.sessionId');
const saved=await evaluate(`window.ghost.browser.replayPreview(${JSON.stringify(token)})`);if(saved.inputs[0].value!=='Saved replacement')throw Error('Input not persisted');
omitSave=true;await evaluate(`window.ghost.browser.replayStart(${JSON.stringify(token)})`);await until(`window.__replay.state==='failed'`);if(!(await evaluate('window.__replay.error')).includes('missing'))throw Error('Missing target did not fail clearly');
await evaluate(`window.ghost.browser.replayStart(${JSON.stringify(token)})`);await evaluate(`window.ghost.browser.replayCancel(${JSON.stringify(token)})`);await until(`window.__replay.state==='cancelled'`);
console.log('PASS: recording → UI confirmation → replay; saved input override and checkbox restored; absent cookie banner skipped; save clicked once; missing-target failure; cancellation.');
void evaluate(`window.ghost.controlWindow('close')`);await pause(100);
} finally {guest?.ws.close();host.ws.close();server.closeAllConnections();server.close()}
