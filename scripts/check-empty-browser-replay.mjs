import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/main/replayRecording.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {replayRecording}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const abort=new AbortController();abort.abort();const states=[];
const browser={getURL:()=>'',isDestroyed:()=>false,session:{on(){},removeListener(){}},debugger:{isAttached:()=>false},executeJavaScriptInIsolatedWorld:async()=>{throw Error('No document yet')}};
await replayRecording(browser,{isDestroyed:()=>false},[],abort.signal,async state=>states.push(state),async()=>false);
assert.equal(states[0].state,'running');assert.equal(states[0].observedURL,undefined);assert.equal(states.at(-1).state,'cancelled');
console.log('PASS: initial empty browser URL reports progress and cancellation without crashing');
