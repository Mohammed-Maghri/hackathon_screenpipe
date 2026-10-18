import { build } from 'esbuild';
import assert from 'node:assert/strict';
const bundle = await build({entryPoints:['src/main/teachHostedTask.ts'], bundle:true,write:false,platform:'node',format:'esm'});
const {teachHostedTask} = await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function fixture(path='/nova/restocking') {
 let downloads=0; const clicks=[];
 const contents={getURL:()=>`https://hackathon-screenpipe.vercel.app${path}`,isDestroyed:()=>false,focus(){},executeJavaScript:async()=>({x:10,y:20}),sendInputEvent(event){clicks.push(event);if(event.type==='mouseUp')downloads++}};
 return {contents,clicks,count:async()=>downloads};
}
for(const [path,count] of [['/nova/restocking',3],['/finance',1]]) {
 const f=fixture(path);await teachHostedTask(f.contents,new AbortController().signal,()=>true,f.count);
 assert.equal(f.clicks.length,count*2);assert.equal(await f.count(),count);
}
const unsupported=fixture('/nova/login');
await assert.rejects(()=>teachHostedTask(unsupported.contents,new AbortController().signal,()=>true,unsupported.count),/supports only/);
assert.equal(unsupported.clicks.length,0);
const cancelled=fixture();const controller=new AbortController();controller.abort();
await assert.rejects(()=>teachHostedTask(cancelled.contents,controller.signal,()=>true,cancelled.count));assert.equal(cancelled.clicks.length,0);
const ambiguous=fixture();ambiguous.contents.executeJavaScript=async()=>{throw Error('Ambiguous export button')};
await assert.rejects(()=>teachHostedTask(ambiguous.contents,new AbortController().signal,()=>true,ambiguous.count),/Ambiguous/);assert.equal(ambiguous.clicks.length,0);
const changed=fixture();let reads=0;changed.contents.getURL=()=>++reads===1?'https://hackathon-screenpipe.vercel.app/nova/restocking':'https://example.com';
await assert.rejects(()=>teachHostedTask(changed.contents,new AbortController().signal,()=>true,changed.count),/page changed/);assert.equal(changed.clicks.length,0);
const interrupted=fixture();const interrupt=new AbortController();
interrupted.contents.sendInputEvent=event=>{interrupted.clicks.push(event);if(event.type==='mouseUp')interrupt.abort()};
await assert.rejects(()=>teachHostedTask(interrupted.contents,interrupt.signal,()=>true,async()=>0));
assert.equal(interrupted.clicks.length,2,'An uncertain dispatched click must not be repeated');
console.log('PASS: hosted task exports, unsupported page, cancellation, ambiguous target, unexpected navigation');
