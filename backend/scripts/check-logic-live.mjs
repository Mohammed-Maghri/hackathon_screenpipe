// Opt-in live smoke test: sends synthetic column names only, never user files or rows.
import 'dotenv/config'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { generationResponseSchema, validatePlan } from '../dist/contracts/processingPlan.js'
if (!process.env.OPENAI_API_KEY) throw new Error('Backend OPENAI_API_KEY is not configured.')
if (process.argv.includes('--json') || process.argv.includes('--rows')) {
 const {generateProcessingLogic}=await import('../dist/modules/workflows/processing-logic.js')
 const rows=process.argv.includes('--rows'),workflowId='80000000-0000-4000-8000-000000000001',source='80000000-0000-4000-8000-000000000002',nodeId='80000000-0000-4000-8000-000000000003'
 const expectedOutput={format:rows?'rows':'json',filename:rows?null:'report.json'}
 const inputSchema={version:1,datasets:[{id:'files_0',input:'files',format:'csv',sheet:null,fields:[{name:'id',types:['string'],nullCount:0},{name:'amount',types:['string'],nullCount:0}],rowCount:2,samples:[],structure:null}],warnings:[]}
 const workflow={id:workflowId,updatedAt:new Date(),nodes:[{id:source,config:{stepType:'browser'}},{id:nodeId,config:{stepType:'data_processing',description:rows?'Convert the downloaded CSV into structured JSON rows and return the row count.':'Convert the downloaded CSV into JSON format and save it locally.',dataProcessing:{version:1,mode:'generated',operation:'read_files',rules:{},inputs:{files:{nodeId:source,output:'files',type:'files'}},expectedOutput}}}],edges:[{sourceNodeId:source,targetNodeId:nodeId}]}
 const service={get:async()=>workflow,saveNodeLogic:async()=>{}}
 const result=await generateProcessingLogic(service,{workflowId,nodeId,inputSchema,consent:{schema:true,samples:false}},{apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL})
 assert.equal(result.status,'needs_review',result.reason);validatePlan(result.draft.plan,inputSchema,expectedOutput)
 console.log('PASS live production generation: CSV → '+(rows?'structured JSON rows with null filename':'local JSON file')+'; validated plan, synthetic metadata only.')
 process.exit(0)
}
const original = process.argv.includes('--original')
const schema = original ? z.toJSONSchema(generationResponseSchema) : (await import('../dist/modules/workflows/processing-schema.js')).processingResponseJsonSchema
const inputSchema = {version:1,datasets:[{id:'files_0',input:'files',format:'csv',sheet:null,fields:[{name:'id',types:['string'],nullCount:0},{name:'status',types:['string'],nullCount:0}],rowCount:2,samples:[],structure:null}],warnings:[]}
const expectedOutput = {format:'csv',filename:'result.csv'}
const response = await fetch('https://api.openai.com/v1/responses', {method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(60000),body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',store:false,max_output_tokens:1500,instructions:'Return a declarative processing plan. Read source files_0 and export to result.csv. Do not invent columns. Return status needs_review, reason empty string.',input:JSON.stringify({inputSchema,expectedOutput}),text:{format:{type:'json_schema',name:'ghost_processing_plan',strict:true,schema}}})})
const data = await response.json()
if(!response.ok){
 const message=String(data.error?.message??'Request rejected').replaceAll(process.env.OPENAI_API_KEY,'[redacted]').replace(/sk-[\w-]+/g,'[redacted]').slice(0,1500)
 console.log(JSON.stringify({status:response.status,code:data.error?.code,param:data.error?.param,message}));process.exitCode=1
}else{
 assert.equal(data.status,'completed')
 const text=data.output.filter(o=>o.type==='message').flatMap(o=>o.content??[]).filter(o=>o.type==='output_text').map(o=>o.text).join('')
 const result=generationResponseSchema.parse(JSON.parse(text));assert.ok(result.plan);validatePlan(result.plan,inputSchema,expectedOutput)
 console.log('PASS live OpenAI: schema accepted, plan generated and locally validated using synthetic CSV metadata.')
}
