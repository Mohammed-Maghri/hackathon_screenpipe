import electronPath from 'electron';
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
const port=9342, debug=9232
let mode='same'
const child=`<!doctype html><label>Name<input id="name"></label><label>Code<input id="otp" autocomplete="one-time-code"></label><button id="save">Save item</button><a id="next" href="/done">Continue</a><span id="status" role="status"></span><div id="scroll" style="height:40px;overflow:auto"><div style="height:300px">Scroll area</div></div><script>document.documentElement.dataset.isolation=JSON.stringify({require:typeof require,process:typeof process,ghost:typeof window.ghost});window.saves=0;save.onclick=()=>{window.saves++;document.body.dataset.saves=window.saves;document.querySelector('#status').textContent='Saved '+document.querySelector('#name').value};</script>`
const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','text/html')
  if(req.url==='/child')return res.end(child)
  if(req.url==='/done')return res.end('<h1>Done</h1><span role="status">Finished</span>')
  if(req.url==='/middle')return res.end(`<iframe name="inner" src="http://localhost:${port}/child" width="470" height="220"></iframe>`)
  const source=mode==='nested'?'/middle':`http://${mode==='cross'?'localhost':'127.0.0.1'}:${port}/child`
  res.end(`<!doctype html><button id="go">Main action</button><div id="container"><iframe name="workspace" src="${source}" width="530" height="330"></iframe></div><script>window.addDuplicate=()=>container.insertAdjacentHTML('beforeend',container.innerHTML);</script>`)
})
await new Promise(r=>server.listen(port,'127.0.0.1',r))
const profile=await mkdtemp('/tmp/ghost-frame-tests-')
const electron=spawn(electronPath,['.','--ozone-platform=x11',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`],{stdio:['ignore','ignore','pipe']})
let logs='';electron.stderr.on('data',d=>logs+=d)
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function until(fn,message,timeout=15000){const start=Date.now();do{const v=await fn();if(v)return v;await sleep(40)}while(Date.now()-start<timeout);throw Error(message)}
async function connect(target){const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});let id=0;const pending=new Map();ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);if(!p)return;pending.delete(d.id);clearTimeout(p.timer);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result)}};return{close(){ws.close();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('closed'))}pending.clear()},call(method,params={},sessionId){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method))},15000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}))})},async eval(expression,contextId,sessionId){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,...(contextId?{contextId}:{})},sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}}}
const pages=()=>fetch(`http://127.0.0.1:${debug}/json`).then(r=>r.json())
let host,guest
const checks=[]
const runs=Number(process.env.GHOST_FRAME_RUNS ?? 3), counts={same:0,cross:0,nested:0}
assert.ok(Number.isInteger(runs)&&runs>0&&runs<=100)
try{
await until(async()=>{try{return(await pages()).length}catch{return false}},'Electron startup')
host=await connect((await pages()).find(p=>p.url.includes('index.html')))
await until(()=>host.eval('!!window.ghost?.browser'),'Host preload')
await host.eval(`window.__state=null;window.__replay=null;window.ghost.browser.onState(s=>window.__state=s);window.ghost.browser.onReplay(s=>window.__replay=s.status)`)
const api=(method,...args)=>host.eval(`window.ghost.browser[${JSON.stringify(method)}](...${JSON.stringify(args)})`)
async function open(scenario){mode=scenario;guest?.close();await host.eval(`location.hash='/workflows'`);await until(()=>host.eval(`!document.querySelector('.record-shell')`),'Close previous route');await host.eval(`window.__state=null;window.__replay=null;location.hash='/workflows/orders/record/slack'`);await until(()=>host.eval(`window.__state?.sessionId && !document.querySelector('[aria-label="Website address"]')?.disabled`),'Browser ready');const token=await host.eval('window.__state.sessionId');await api('navigate',token,`http://127.0.0.1:${port}/fixture`);await until(()=>host.eval(`window.__state?.url.includes('${port}')&&!window.__state.loading`),'Fixture ready');guest=await connect((await pages()).find(p=>p.url.includes(':'+port+'/fixture')));return token}
async function frameContext(){
  const targets=await guest.call('Target.getTargets')
  const target=targets.targetInfos.find(t=>t.type==='iframe'&&t.url.endsWith('/child'))
  let sessionId
  if(target)sessionId=(await guest.call('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId
  const tree=await guest.call('Page.getFrameTree',{},sessionId)
  const find=t=>t.frame.url.endsWith('/child')?t.frame:(t.childFrames??[]).map(find).find(Boolean)
  const frame=find(tree.frameTree);if(!frame)throw Error('Child frame not found')
  const context=(await guest.call('Page.createIsolatedWorld',{frameId:frame.id,worldName:'ghost-test-only'},sessionId)).executionContextId
  return {eval:expression=>guest.eval(expression,context,sessionId),sessionId}
}
async function point(context,selector){
  const point=await context.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  const offsets=await guest.eval(`(()=>{const f=document.querySelector('iframe');f.scrollIntoView({block:'center'});const r=f.getBoundingClientRect();return {x:r.x+f.clientLeft,y:r.y+f.clientTop}})()`)
  if(mode==='nested'){const inner=await guest.eval(`(()=>{const f=document.querySelector('iframe').contentDocument.querySelector('iframe');const r=f.getBoundingClientRect();return{x:r.x+f.clientLeft,y:r.y+f.clientTop}})()`);offsets.x+=inner.x;offsets.y+=inner.y}
  return {x:point.x+offsets.x,y:point.y+offsets.y}
}
async function click(context,selector){const p=await point(context,selector);await guest.call('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await guest.call('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await guest.call('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1})}
async function replay(token){await host.eval('window.__replay=null');await api('replayStart',token);const approved=new Set();await until(async()=>{const s=await host.eval('window.__replay');if(s?.state==='needs-user-approval'&&!approved.has(s.sequence)){approved.add(s.sequence);await api('replayApprove',token,s.sequence,true)}return s&&['completed','failed','unknown','cancelled'].includes(s.state)},'Replay completion',30000);return host.eval('window.__replay')}
for(const scenario of ['same','cross','nested']){
 for(let run=0;run<runs;run++){
 const token=await open(scenario);const context=await frameContext()
 assert.deepEqual(await context.eval(`JSON.parse(document.documentElement.dataset.isolation)`),{require:'undefined',process:'undefined',ghost:'undefined'})
 await guest.call('Emulation.setFocusEmulationEnabled',{enabled:true});if(context.sessionId)await guest.call('Emulation.setFocusEmulationEnabled',{enabled:true},context.sessionId);await click(context,'#name');await guest.call('Input.insertText',{text:'Frame report'},context.sessionId);await until(()=>context.eval(`document.querySelector('#name').value==='Frame report'`),'Frame native input')
 await click(context,'#save');await until(()=>context.eval(`document.querySelector('#status').textContent==='Saved Frame report'`),'Frame save evidence')
 await api('recordingControl',token,'stop');const recording=JSON.parse(await api('recordingExport',token));assert.ok(recording.events.some(e=>e.type==='input'&&e.data.framePath?.length===(scenario==='nested'?2:1)))
 assert.deepEqual((await api('replayPreview',token)).blockers,[])
 const result=await replay(token);assert.equal(result.state,'completed',JSON.stringify(result));const live=await frameContext();assert.equal(await live.eval('Number(document.body.dataset.saves)'),1);assert.equal(await live.eval(`document.querySelector('#name').value`),'Frame report')
 counts[scenario]++;console.log('PASS',scenario,counts[scenario]);
 }
 checks.push(scenario+' frame recording, native input, approval, verified replay and isolation')
}
// Pause/resume and secret handling must apply to child preloads too.
let token=await open('cross');let context=await frameContext();await api('recordingControl',token,'pause');await click(context,'#name');await guest.call('Input.insertText',{text:'PAUSED'});await api('recordingControl',token,'resume');await click(context,'#otp');await guest.call('Input.insertText',{text:'SECRET-OTP'});await api('recordingControl',token,'stop');let exported=await api('recordingExport',token);assert.ok(!exported.includes('SECRET-OTP')&&!exported.includes('PAUSED'));assert.ok((await api('replayPreview',token)).blockers.some(b=>b.includes('authentication')));await assert.rejects(()=>api('replayStart',token));checks.push('subframe pause/resume and sensitive-field masking')
// Duplicate frame names/URLs must stop; never choose the first.
token=await open('same');context=await frameContext();await click(context,'#name');await guest.call('Input.insertText',{text:'Unique'});await api('recordingControl',token,'stop');await guest.eval('window.addDuplicate()');
// Replay reloads initial state, so add a duplicate on each subsequent fixture load.
mode='same';const oldListeners=server.listeners('request');server.removeAllListeners('request');server.on('request',(req,res)=>{if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');res.end(`<iframe name="workspace" src="/child"></iframe><iframe name="workspace" src="/child"></iframe>`)}else oldListeners[0](req,res)})
let result=await replay(token);assert.equal(result.state,'failed');assert.match(result.error,/Ambiguous/);checks.push('ambiguous frame replay stops before dispatch');server.removeAllListeners('request');server.on('request',oldListeners[0])
// Reordering unrelated embeds must not change which frame receives the action.
token=await open('same');context=await frameContext();await click(context,'#name');await guest.call('Input.insertText',{text:'Reordered'});await click(context,'#save');await until(()=>context.eval(`document.querySelector('#status').textContent==='Saved Reordered'`),'Reorder recording evidence');await api('recordingControl',token,'stop');
server.removeAllListeners('request');server.on('request',(req,res)=>{if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');res.end(`<iframe name="unrelated" src="/done" height="70"></iframe><iframe name="workspace" src="/child" width="530" height="330"></iframe>`)}else oldListeners[0](req,res)})
result=await replay(token);assert.equal(result.state,'completed',JSON.stringify(result));checks.push('reordered frames resolve by identity, not index');server.removeAllListeners('request');server.on('request',oldListeners[0])
// Missing and transformed frames stop before sending a click.
for(const failure of ['missing','transformed']){
 token=await open('same');context=await frameContext();await click(context,'#name');await guest.call('Input.insertText',{text:'Expected'});await api('recordingControl',token,'stop');
 server.removeAllListeners('request');server.on('request',(req,res)=>{if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');res.end(failure==='missing'?'<h1>No frame</h1>':`<iframe name="workspace" src="/child" style="transform:rotate(2deg)" width="530" height="330"></iframe>`)}else oldListeners[0](req,res)})
 result=await replay(token);assert.equal(result.state,'failed',JSON.stringify(result));checks.push(failure+' frame stops without dispatch');server.removeAllListeners('request');server.on('request',oldListeners[0])
}
// A link navigating only the child frame is verified without navigating the host.
token=await open('same');context=await frameContext();await click(context,'#next');await until(async()=>JSON.parse(await api('recordingExport',token)).events.some(e=>e.type==='frame-navigation'),'Frame navigation captured');await api('recordingControl',token,'stop');result=await replay(token);assert.equal(result.state,'completed',JSON.stringify(result));checks.push('child-frame navigation verified')
token=await open('same');context=await frameContext();await context.eval(`document.querySelector('#next').href='#section'`);await click(context,'#next');await until(async()=>JSON.parse(await api('recordingExport',token)).events.some(e=>e.type==='frame-navigation'),'Frame hash navigation captured');await api('recordingControl',token,'stop');
server.removeAllListeners('request');server.on('request',(req,res)=>{if(req.url==='/child'){res.setHeader('Content-Type','text/html');res.end(child.replace('href="/done"','href="#section"'))}else oldListeners[0](req,res)})
result=await replay(token);assert.equal(result.state,'completed',JSON.stringify(result));checks.push('same-document child-frame navigation verified');server.removeAllListeners('request');server.on('request',oldListeners[0])
await writeFile('docs/frame-support-results.json',JSON.stringify({date:new Date().toISOString(),counts,checks},null,2));console.log('PASS',checks)
}catch(error){console.error(error);if(host)console.error('Replay',await host.eval('window.__replay').catch(String));console.error(logs.slice(-1800));process.exitCode=1}
finally{guest?.close();host?.close();electron.kill('SIGTERM');const timer=setTimeout(()=>electron.kill('SIGKILL'),2000);timer.unref();server.closeAllConnections();server.close()}
