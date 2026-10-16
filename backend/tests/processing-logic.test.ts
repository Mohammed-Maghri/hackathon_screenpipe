import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerWorkflowRoutes } from '../src/modules/workflows/workflow.routes.js'
import { registerErrorHandler } from '../src/errors/handler.js'
import type { WorkflowService } from '../src/modules/workflows/workflow.service.js'
const workflowId='80000000-0000-4000-8000-000000000001',sourceId='80000000-0000-4000-8000-000000000002',nodeId='80000000-0000-4000-8000-000000000003'
const schema={version:1,datasets:[{id:'files_0',input:'files',format:'xlsx',sheet:'Transactions',fields:[{name:'id',types:['string'],nullCount:0},{name:'status',types:['string'],nullCount:0}],rowCount:2,samples:[],structure:null}],warnings:[]}
const validPlan={version:1,steps:[{id:'failed',source:'files_0',type:'filter',column:'status',operator:'eq',value:'Failed'}]}
test('runtime logic uses saved objectives, consent, validated plans and versioned approval',async()=>{
 const workflow:any={id:workflowId,updatedAt:new Date(),nodes:[{id:sourceId,config:{stepType:'browser'}},{id:nodeId,config:{stepType:'data_processing',description:'Keep rows whose status is Failed.',dataProcessing:{version:1,mode:'generated',operation:'read_files',inputs:{files:{nodeId:sourceId,output:'files',type:'files'}},rules:{},expectedOutput:{format:'rows',filename:null}}}}],edges:[{sourceNodeId:sourceId,targetNodeId:nodeId}]}
 let rejection:{status:number;code:string}|null=null
 let model:any={status:'needs_review',reason:'',plan:validPlan},calls=0,requestBody:any
 const originalFetch=globalThis.fetch
 globalThis.fetch=async(_url,options)=>{if(rejection)return Response.json({error:{code:rejection.code,message:'private provider error containing sk-secret and private inputs'}},{status:rejection.status});calls++;requestBody=JSON.parse(String(options?.body));return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(model)}]}]}),{status:200})}
 const service={get:async()=>structuredClone(workflow),saveNodeLogic:async(_w:string,id:string,patch:unknown,expected:Date)=>{assert.equal(expected.getTime(),workflow.updatedAt.getTime());const node=workflow.nodes.find((n:any)=>n.id===id);node.config={...node.config,...patch as object};workflow.updatedAt=new Date(workflow.updatedAt.getTime()+1)}} as unknown as WorkflowService
 const app=Fastify();registerErrorHandler(app);registerWorkflowRoutes(app,service,{apiKey:'test-key',model:'test-model'})
 const payload={workflowId,nodeId,inputSchema:schema,consent:{schema:true,samples:false}}
 const generate=(body:unknown=payload)=>app.inject({method:'POST',url:'/api/workflows/nodes/generate-logic',payload:body as object})
 try{
  assert.equal((await generate({...payload,consent:{schema:false,samples:false}})).statusCode,400);assert.equal(calls,0)
  assert.equal((await generate({...payload,objective:'Injected override'})).statusCode,400)
  const generated=await generate();assert.equal(generated.statusCode,200,generated.body);const draft=generated.json().draft
  assert.equal(JSON.parse(requestBody.input[0].content).objective,'Keep rows whose status is Failed.');assert.ok(JSON.parse(requestBody.input[0].content).operationGuide.export.includes('.json'));assert.equal(requestBody.store,false);assert.equal(requestBody.text.format.strict,true);assert.equal(JSON.stringify(requestBody.text.format.schema).includes('"oneOf"'),false);assert.ok(JSON.stringify(requestBody.text.format.schema).includes('"anyOf"'))
  assert.equal(workflow.nodes[1].config.dataProcessing.approvedPlan,undefined)
  model={status:'needs_review',reason:'',plan:{version:1,steps:[{...validPlan.steps[0],column:'Imaginary'}]}}
  assert.equal((await generate()).json().status,'needs_configuration');assert.deepEqual(workflow.nodes[1].config.logicDraft.plan,validPlan)
  model={status:'needs_configuration',reason:'Expected identifiers missing.',plan:null};assert.equal((await generate()).json().status,'needs_configuration')
  const approve={workflowId,nodeId,plan:validPlan,testId:'a0000000-0000-4000-8000-000000000001',fingerprint:draft.fingerprint,bindingHash:draft.bindingHash,objective:draft.objective,version:draft.version}
  const approval=(body:unknown)=>app.inject({method:'POST',url:'/api/workflows/nodes/approve-logic',payload:body as object})
  assert.equal((await approval({...approve,objective:'Changed'})).statusCode,409)
  assert.equal((await approval({...approve,plan:{version:1,steps:[{...validPlan.steps[0],column:'Invented'}]}})).statusCode,400)
  const approved=await approval(approve);assert.equal(approved.statusCode,200,approved.body);assert.equal(approved.json().version,1);assert.equal(workflow.nodes[1].config.logicDraft,null)
  model={status:'needs_review',reason:'',plan:validPlan};assert.equal((await generate()).json().draft.version,2);assert.equal(workflow.nodes[1].config.dataProcessing.approvedPlan.version,1)
  workflow.nodes[1].config.description='Changed after generation';assert.equal((await approval({...approve,version:2})).statusCode,409)
  for(const [status,code,expected] of [[400,'invalid_json_schema','processing schema'],[401,'invalid_api_key','API key'],[403,'permission_denied','permissions'],[404,'model_not_found','model'],[429,'insufficient_quota','credits'],[429,'rate_limit_exceeded','rate limiting'],[503,'server_error','temporarily unavailable']] as const){
   rejection={status,code};const failure=await generate();assert.ok(failure.statusCode>=500);assert.ok(failure.json().error.message.includes(expected),failure.body);assert.ok(!failure.body.includes('sk-secret'));assert.equal(workflow.nodes[1].config.dataProcessing.approvedPlan.version,1)
  }
 }finally{globalThis.fetch=originalFetch;await app.close()}
})
