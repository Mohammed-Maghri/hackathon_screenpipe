import Fastify from 'fastify'
import { registerWorkflowRoutes } from '../src/modules/workflows/workflow.routes.js'
import { registerErrorHandler } from '../src/errors/handler.js'
import { configureNodeContracts } from '../src/modules/workflows/node-contract.js'
import type { WorkflowService } from '../src/modules/workflows/workflow.service.js'
// In-memory persistence and deterministic model; all production route validation is retained.
export async function startFixture(initial:any){
 let workflow={...initial,updatedAt:new Date()},calls=0
 let generationGate:Promise<void>|null=null, releaseGeneration:(()=>void)|undefined
 const original=globalThis.fetch
 globalThis.fetch=async(url,options)=>{
  if(String(url)!=='https://api.openai.com/v1/responses')return original(url,options)
  calls++
  if(generationGate)await generationGate
  const body=JSON.parse(String(options?.body)),input=JSON.parse(body.input[0].content),datasets=input.inputSchema.datasets
  if(datasets.some((d:any)=>d.samples.length))throw Error('Samples sent without test consent')
  const plan={version:1,steps:[{id:'merged',type:'merge',source:datasets[0].id,other:datasets[1].id},{id:'failed',type:'filter',source:'merged',column:'status',operator:'eq',value:'failed'},{id:'report',type:'export',source:'failed',filename:input.expectedOutput.filename}]}
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({status:'needs_review',reason:'',plan})}]}]})
 }
 const service={get:async()=>structuredClone(workflow),update:async(_id:string,patch:any)=>{workflow={...workflow,...patch,updatedAt:new Date()};workflow.nodes=configureNodeContracts(workflow.nodes,workflow.edges);return structuredClone(workflow)},saveNodeLogic:async(_wf:string,id:string,patch:any,expected:Date)=>{if(expected.getTime()!==workflow.updatedAt.getTime())throw Error('Stale workflow');const node=workflow.nodes.find((n:any)=>n.id===id);node.config={...node.config,...patch};workflow.updatedAt=new Date(workflow.updatedAt.getTime()+1)}} as unknown as WorkflowService
 const app=Fastify();registerErrorHandler(app);registerWorkflowRoutes(app,service,{apiKey:'fixture-only'})
 const url=await app.listen({host:'127.0.0.1',port:0})
 return {url,holdGeneration(){generationGate=new Promise<void>(resolve=>{releaseGeneration=resolve})},releaseGeneration(){releaseGeneration?.();generationGate=null},get workflow(){return workflow},get calls(){return calls},async close(){releaseGeneration?.();globalThis.fetch=original;await app.close()}}
}
