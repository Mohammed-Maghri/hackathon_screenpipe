import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { formatAgentAnswer, formatAndSaveAgent } from '../src/modules/discovery/discovery.format.js'
import type { WorkflowService } from '../src/modules/workflows/workflow.service.js'
const requestId=randomUUID()
const source={requestId,workflow:{name:'Open browser',description:'Chrome was visible'},steps:[{id:'step_1',name:'Open Chrome',application:'Google Chrome',type:'application',startUrl:null,websiteUrl:null,status:'needs_configuration',evidenceIds:['frame_id:1'],description:'Only a Chrome window was visible; launching it is not established.',missingInformation:['Confirm the intended starting page.']}],missingInformation:['Only one frame was available.']}
const input={requestId,prompt:'Open browser',timeRange:'Last 30 days',pipeId:'ghost-workflow-discovery',executionId:12,responseText:JSON.stringify(source)}
const formatted=()=>({requestId,workflow:source.workflow,steps:[{id:'step_1',name:'Review Chrome window',description:'Chrome was visible; confirm the intended launch task.',application:'Google Chrome',type:'application',startUrl:null,basis:'inferred',references:['frame_id:1'],missingInformation:['Confirm the intended action.']}],missingInformation:[]})
test('backend formatter handles legacy Screenpipe JSON and preserves caveats',async()=>{
 const original=globalThis.fetch
 try {
 globalThis.fetch=async(_,init)=>{const body=JSON.parse(String(init?.body));assert.equal(body.store,false);assert.equal(body.tools,undefined);assert.equal(body.text.format.type,'json_schema');assert.ok(!JSON.stringify(body.text.format.schema).includes('\"format\":\"uri\"'));assert.equal(JSON.parse(body.input[0].content).screenpipeAnswer,input.responseText);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(formatted())}]}]})}
 const result=await formatAgentAnswer(input,{apiKey:'test'});assert.deepEqual(result.steps[0]!.references,['frame_id:1']);assert.ok(result.missingInformation.includes('Only one frame was available.'));assert.ok(result.missingInformation.includes('Confirm the intended starting page.'))
 }finally{globalThis.fetch=original}
})
test('formatter rejects unsupported output and handles provider failure without save',async t=>{
 const original=globalThis.fetch
 try{
 for(const mode of ['invented-reference','invented-url','wrong-request','incomplete','refusal','http-error','offline'])await t.test(mode,async()=>{
 globalThis.fetch=async()=>{if(mode==='offline')throw new Error('private provider details');if(mode==='http-error')return new Response('{}',{status:429});const out=formatted();if(mode==='invented-reference')out.steps[0]!.references=['fake'];if(mode==='invented-url')Object.assign(out.steps[0]!,{type:'browser',startUrl:'https://invented.example/'});if(mode==='wrong-request')out.requestId=randomUUID();return Response.json({status:mode==='incomplete'?'incomplete':'completed',output:[{type:'message',content:[{type:mode==='refusal'?'refusal':'output_text',text:JSON.stringify(out)}]}]})}
 await assert.rejects(()=>formatAgentAnswer(input,{apiKey:'test'}))
 })
 globalThis.fetch=async()=>{assert.fail('Should not call AI')}
 await assert.rejects(()=>formatAgentAnswer({...input,responseText:JSON.stringify({...source,steps:[]})},{apiKey:'test'}),/insufficient history/)
 await assert.rejects(()=>formatAgentAnswer(input,{}),/backend OpenAI key/)
 const existing={id:requestId,nodes:[{config:{discoveryRequestHash:(await import('../src/modules/discovery/discovery.screenpipe.js')).discoveryRequestHash(input.prompt,input.timeRange)}}]}
 assert.equal(await formatAndSaveAgent({find:async()=>existing} as unknown as WorkflowService,input,{}),existing)
 }finally{globalThis.fetch=original}
})
