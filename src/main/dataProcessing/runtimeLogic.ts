import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { getSavedWorkflow } from '../discoveryBackend'
import { graphSchema, processingSchema, validateProcessing, isUpstream, type DataValue, type ProcessingConfig } from '../../shared/dataProcessing'
import { approvedPlanSchema, expectedOutputSchema, planSchema, bindingShape, type Inspection, type LogicDraft, type LogicTest, type ProcessingPlan, type ApprovedPlan } from '../../../backend/src/contracts/processingPlan'
import { LocalArtifacts } from './executor'
import { digest } from './outputInspector'
import { runProcessingWorker, type WorkerResult } from './runWorker'
import { verifiedBrowserOutputs, browserRunStamp } from './browserOutputs'
import { LocalProcessingService } from './service'

type Context={workflowId:string;nodeId:string;config:ProcessingConfig;objective:string;artifacts:LocalArtifacts;inputs:Record<string,DataValue>;inspection:WorkerResult;stamps:Record<string,string>;upstreamHash:string;expires:number;draft?:LogicDraft;tested?:{id:string;plan:ProcessingPlan;outputs:Record<string,DataValue>}}
export class RuntimeLogicService{
 private contexts=new Map<string,Context>()
 constructor(private userData:string,private processing:LocalProcessingService){processing.generatedExecutor=(...args)=>this.executeApproved(...args)}
 private async saved(workflowId:string,nodeId:string){
  z.string().uuid().parse(workflowId);z.string().uuid().parse(nodeId)
  const result=await getSavedWorkflow(workflowId);if(!result.ok)throw new Error(result.error)
  const node=result.workflow.nodes.find(n=>n.id===nodeId)
  if(!node||node.config.stepType!=='data_processing')throw new Error('Processing node not found.')
  const config=processingSchema.parse(node.config.dataProcessing)
  if(config.mode!=='generated')throw new Error('Save runtime-generated mode before inspecting.')
  expectedOutputSchema.parse(config.expectedOutput)
  return {workflow:result.workflow,node,config,objective:String(node.config.description??'').trim()}
 }
 async inspect(workflowId:string,nodeId:string):Promise<Inspection>{
  try{
   for(const [key,context] of this.contexts)if(context.expires<Date.now()||(context.workflowId===workflowId&&context.nodeId===nodeId))this.contexts.delete(key)
   if(this.contexts.size>=10)throw new Error('Close an inspection before opening more nodes.')
   const saved=await this.saved(workflowId,nodeId),graph=graphSchema.parse(saved.workflow),errors=validateProcessing(graph,nodeId)
   if(errors.length)throw new Error(errors.join('\n'))
   const artifacts=new LocalArtifacts(join(this.userData,'processing',digest(workflowId))),inputs:Record<string,DataValue>={},stamps:Record<string,string>={}
   for(const source of graph.nodes.filter(n=>n.config.stepType==='browser'&&isUpstream(graph,n.id,nodeId)))stamps[source.id]=await browserRunStamp(this.userData,workflowId,source.id)
   for(const [name,ref] of Object.entries(saved.config.inputs)){
    const source=graph.nodes.find(n=>n.id===ref.nodeId)!
    let outputs:Record<string,DataValue>
    if(source.config.stepType==='browser')outputs=await verifiedBrowserOutputs(this.userData,workflowId,source.id,artifacts)
    else {const results=await this.processing.run({workflowId,graph,nodeId:source.id});const result=results.find(r=>r.nodeId===source.id);if(result?.status!=='VERIFIED')throw new Error(result?.error??'Upstream output unavailable.');outputs=result.outputs
      // Authorized upstream generated artifacts are imported through the service, never renderer paths.
      for(const value of Object.values(outputs))if(value.type==='files')for(let i=0;i<value.value.length;i++){const file=value.value[i];const path=await this.processing.path(workflowId,file.id);value.value[i]=await artifacts.register(path,join(this.userData,'processing'),file.name)}
    }
    const value=outputs[ref.output];if(!value||value.type!==ref.type)throw new Error(`waiting_for_input: Verified output ${name} is unavailable. Configure capture and replay the upstream browser node.`)
    inputs[name]=value
   }
   const inspection=await runProcessingWorker(artifacts,inputs),id=randomUUID()
   this.contexts.set(id,{workflowId,nodeId,config:saved.config,objective:saved.objective,artifacts,inputs,inspection,stamps,upstreamHash:this.upstreamHash(graph,nodeId),expires:Date.now()+30*60*1000})
   return {status:'ready_to_generate',id,schema:inspection.schema,fingerprint:inspection.fingerprint,objective:saved.objective,expectedOutput:saved.config.expectedOutput,artifacts:Object.values(inputs).flatMap(v=>v.type==='files'?v.value.map(f=>({name:f.name,format:f.format,bytes:f.bytes})):[])}
  }catch(e){const error=e instanceof Error?e.message:'Inspection failed.';return {status:/waiting_for_input|upstream|recording/i.test(error)?'waiting_for_input':'failed',error}}
 }
 private get(id:string){const context=this.contexts.get(z.string().uuid().parse(id));if(!context||context.expires<Date.now())throw new Error('Inspection expired. Inspect inputs again.');return context}
 private upstreamHash(graph:ReturnType<typeof graphSchema.parse>,nodeId:string){return digest(graph.nodes.filter(n=>isUpstream(graph,n.id,nodeId)).map(n=>({id:n.id,config:n.config})).sort((a,b)=>a.id.localeCompare(b.id)))}
 private async check(context:Context){
  const saved=await this.saved(context.workflowId,context.nodeId)
  if(saved.objective!==context.objective||digest(bindingShape(saved.config.inputs))!==digest(bindingShape(context.config.inputs))||digest(saved.config.expectedOutput)!==digest(context.config.expectedOutput))throw new Error('Objective, output or input mapping changed. Inspect again.')
  if(this.upstreamHash(graphSchema.parse(saved.workflow),context.nodeId)!==context.upstreamHash)throw new Error('Upstream configuration changed. Inspect and test again.')
  for(const [id,stamp] of Object.entries(context.stamps))if(await browserRunStamp(this.userData,context.workflowId,id)!==stamp)throw new Error('Upstream output changed. Inspect and test again.')
  for(const value of Object.values(context.inputs))if(value.type==='files')for(const file of value.value)await context.artifacts.resolve(file)
  return saved
 }
 async generate(id:string,shareSamples:boolean,consent:boolean){
  if(consent!==true)throw new Error('Review the schema and explicitly consent before sending it to OpenAI.')
  const context=this.get(id);await this.check(context);context.tested=undefined
  const inputSchema={...context.inspection.schema,datasets:context.inspection.schema.datasets.map(d=>({...d,samples:shareSamples===true?d.samples:[]}))}
  const result=await this.post('/api/workflows/nodes/generate-logic',{workflowId:context.workflowId,nodeId:context.nodeId,inputSchema,consent:{schema:true,samples:shareSamples===true}}) as {status:'needs_review'|'needs_configuration';reason?:string;draft?:LogicDraft}
  context.draft=result.draft
  return result
 }
 async test(id:string,rawPlan:ProcessingPlan):Promise<LogicTest>{
  const context=this.get(id);context.tested=undefined
  try{
   if(!context.draft)throw new Error('Generate a draft before testing.')
   await this.check(context)
   const plan=planSchema.parse(rawPlan),result=await runProcessingWorker(context.artifacts,context.inputs,{plan,expectedOutput:context.config.expectedOutput,fingerprint:context.inspection.fingerprint})
   context.artifacts.restore(result.manifest!)
   const outputs=result.outputs!,testId=randomUUID();context.tested={id:testId,plan,outputs}
   return {status:'tested',testId,rows:outputs.rows.type==='rows'?outputs.rows.value.slice(0,20):[],count:outputs.count.type==='number'?outputs.count.value:0,files:outputs.files?.type==='files'?outputs.files.value:[]}
  }catch(e){return {status:'failed',error:e instanceof Error?e.message:'Test failed.',rows:[],count:0,files:[]}}
 }
 async approve(id:string,testId:string):Promise<ApprovedPlan>{
  const context=this.get(id),tested=context.tested,draft=context.draft
  if(!tested||tested.id!==testId||!draft)throw new Error('Successful local testing is required before approval.')
  await this.check(context)
  const approved=approvedPlanSchema.parse(await this.post('/api/workflows/nodes/approve-logic',{workflowId:context.workflowId,nodeId:context.nodeId,plan:tested.plan,testId,fingerprint:context.inspection.fingerprint,bindingHash:draft.bindingHash,objective:context.objective,version:draft.version}))
  const directory=join(this.userData,'processing-approvals');await mkdir(directory,{recursive:true,mode:0o700})
  const path=join(directory,digest([context.workflowId,context.nodeId])+'.json');await writeFile(path+'.tmp',JSON.stringify({hash:digest(approved),approved}),{mode:0o600});await rename(path+'.tmp',path)
  context.tested=undefined
  return approved
 }
 async executeApproved(workflowId:string,nodeId:string,requested:ProcessingConfig,inputs:Record<string,DataValue>,artifacts:LocalArtifacts){
  const saved=await this.saved(workflowId,nodeId),approved=approvedPlanSchema.parse(saved.config.approvedPlan)
  if(approved.objective!==saved.objective||approved.bindingHash!==digest(bindingShape(saved.config.inputs))||approved.bindingHash!==digest(bindingShape(requested.inputs))||digest(approved.expectedOutput)!==digest(saved.config.expectedOutput))throw new Error('Processing objective or mapping changed. Review and approve new logic.')
  let receipt:{hash:string};try{receipt=JSON.parse(await readFile(join(this.userData,'processing-approvals',digest([workflowId,nodeId])+'.json'),'utf8'))}catch{throw new Error('This plan has not been tested and approved on this computer.')}
  if(receipt.hash!==digest(approved))throw new Error('Plan changed after approval. Test and approve it again.')
  const result=await runProcessingWorker(artifacts,inputs,{plan:approved.plan,expectedOutput:approved.expectedOutput,fingerprint:approved.fingerprint})
  artifacts.restore(result.manifest!)
  return result.outputs!
 }
 async reveal(id:string,fileId:string){return this.get(id).artifacts.getPath(fileId)}
 private async post(path:string,body:unknown):Promise<unknown>{
  const base=new URL(process.env.GHOST_BACKEND_URL||'http://127.0.0.1:3001');if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw new Error('Invalid backend URL')
  const response=await fetch(new URL(path,base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(75000),redirect:'error'})
  const result=await response.json();if(!response.ok)throw new Error(result?.error?.message??'Logic request failed.');return result
 }
}
