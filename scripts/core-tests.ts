import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareReplay } from '../src/main/prepareReplay'
import { RecordingStore } from '../src/main/recordingStore'
import { recordedURL } from '../src/shared/recordedURL'
import { buildReplayPlan } from '../src/main/replayPlan'
import type { RecordedEvent } from '../src/shared/recording'
let n=0
const event=(type:string,data:Record<string,unknown>={}):RecordedEvent=>({sequence:++n,type,timestamp:'',elapsedMs:n*10,url:'https://example.com/',data:{target:{selector:'#field',id:'field',tag:'input',label:'Name'},...data}})
assert.ok(recordedURL('https://example.com/callback?code=SECRET&access_token=SECRET').redacted)
assert.ok(!recordedURL('https://example.com/callback?code=SECRET&access_token=SECRET').url.includes('SECRET'))
const submitInput = buildReplayPlan([event('click',{target:{selector:'#submit',id:'submit',tag:'input',role:'button',inputType:'submit'}})]).steps[0]
assert.equal(submitInput.data.requiresApproval,true);assert.equal(submitInput.data.focusOnly,false)
const root=await mkdtemp(join(tmpdir(),'ghost-store-test-'))
try {
for(const type of ['popup-open','drag-move','dblclick','unsupported']) {
  const plan=prepareReplay([event(type),event('click')]);assert.ok(plan.preview.blockers.some(b=>b.includes(type)),type+' blocker lost')
}
const input=event('input',{value:'first'}), last=event('input',{value:'final'})
const plan=prepareReplay([input,last],[{sequence:last.sequence,label:'Name',value:'edited'}]);assert.equal(plan.steps.length,1);assert.equal(plan.steps[0].data.value,'edited');assert.equal(last.data.value,'final')
assert.throws(()=>prepareReplay([input],[{sequence:999,label:'Unknown',value:'bad'}]))
assert.ok(prepareReplay([event('click',{target:{selector:'#react-12345',id:'react-12345',tag:'input'}})]).preview.blockers.length)
assert.ok(prepareReplay([event('click',{pointer:{button:1}})]).preview.blockers.length)
assert.ok(prepareReplay([]).preview.blockers.length)
assert.ok(prepareReplay([event('input',{value:'[REDACTED]'})]).preview.blockers.length)
assert.ok(prepareReplay([event('page-ready',{iframeCount:1}),event('click')]).preview.blockers.some(b=>b.includes('frames')))
assert.deepEqual(prepareReplay([event('page-ready',{iframeCount:3,framePolicy:'guarded-main-frame-v1'}),event('click')]).preview.blockers,[])
const frameReason='An embedded frame was entered during recording.'
assert.ok(prepareReplay([event('page-ready',{iframeCount:1,framePolicy:'guarded-main-frame-v1'}),event('unsupported',{reason:frameReason}),event('click')]).preview.blockers.includes(frameReason))
assert.ok(prepareReplay([event('unsupported',{reason:'This page contains frames; frame-aware capture is not supported.'}),event('click')]).preview.blockers.length)
assert.equal(prepareReplay([event('input',{value:'a',framePath:[{name:'first',url:'https://example.com/frame'}]}),event('input',{value:'b',framePath:[{name:'second',url:'https://example.com/frame'}]})]).steps.length,2)
const click=event('click',{actionId:'cause'}), submit=event('submit',{causedBy:'cause'});
assert.equal(buildReplayPlan([click,submit]).steps.length,1)
assert.ok(buildReplayPlan([event('click'),event('submit')]).preview.blockers.some(b=>b.includes('triggering')))
const checked=event('input',{checked:true});assert.equal(buildReplayPlan([event('click'),checked]).steps[0].type,'input')
const store=new RecordingStore(root,'orders','slack');store.append('input','https://example.com/',{value:'test'})
await store.stop();await writeFile(join(store.directory,'inputs.json'),JSON.stringify([{sequence:1,label:'Name',value:'changed'}]));const exported=JSON.parse(await store.exportJSON());assert.equal(exported.exportVersion,3);assert.equal(exported.inputs[0].value,'changed');assert.equal(exported.events[0].data.value,'test');assert.ok((await readFile(join(store.directory,'events.jsonl'),'utf8')).includes('test'))
console.log('PASS core: original blockers, overrides, empty/sensitive/frame cases, causal submission deduplication, control deduplication, complete persistence/export.')
}finally{await rm(root,{recursive:true,force:true})}
