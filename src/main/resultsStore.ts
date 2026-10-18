import {readFile,readdir,realpath,stat} from 'node:fs/promises'
import {join,sep} from 'node:path'
import {parse} from 'csv-parse/sync'
import type {RunSummary,RunComparison} from '../shared/results'
import type {ReplayStatus} from '../shared/recording'
const uuid=(value:string)=>typeof value==='string'&&/^[0-9a-f-]{36}$/i.test(value)
export class ResultsStore {
 constructor(private root:string){}
 private async inside(path:string){const root=await realpath(this.root), file=await realpath(path);if(!file.startsWith(root+sep))throw Error('Result path is outside the recordings directory.');return file}
 private async json(path:string){const file=await this.inside(path);if((await stat(file)).size>2_000_000)throw Error('Result exceeds size limit.');return JSON.parse(await readFile(file,'utf8'))}
 private async report(recordingId:string,runId:string){
  if(!uuid(recordingId)||!uuid(runId))throw Error('Invalid run reference.')
  const value=await this.json(join(this.root,recordingId,'runs',runId+'.json')) as ReplayStatus
  if(value.recordingId!==recordingId||value.runId!==runId||!uuid(value.workflowId??''))throw Error('Run identity mismatch.')
  value.results ??= []; value.artifacts ??= []
  if (!['completed','failed','cancelled','unknown','running','needs-user-approval'].includes(value.state) || !Number.isInteger(value.total) || value.total < 0 || !Array.isArray(value.results) || !Array.isArray(value.artifacts)) throw Error('Invalid result format.')
  if (value.results.some(a=>!Number.isInteger(a.sequence)||typeof a.type!=='string'||typeof a.state!=='string') || value.artifacts.some(a=>typeof a.id!=='string'||typeof a.filename!=='string'||typeof a.path!=='string'||typeof a.state!=='string'||!Number.isFinite(a.bytes)||a.bytes<0)) throw Error('Invalid action or file metadata.')
  return value
 }
 async list():Promise<{runs:RunSummary[];warnings:number}>{
  let dirs;try{dirs=await readdir(this.root,{withFileTypes:true})}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return{runs:[],warnings:0};throw error}
  const runs:RunSummary[]=[];let warnings=0
  for(const dir of dirs.filter(d=>d.isDirectory()&&uuid(d.name))){
   try{
    const session=await this.json(join(this.root,dir.name,'session.json'))
    if(session.id!==dir.name||!uuid(session.nodeId))throw Error('Invalid session.')
    let files;try{files=await readdir(join(this.root,dir.name,'runs'))}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error}
    for(const file of files.filter(f=>f.endsWith('.json')&&uuid(f.slice(0,-5))))try{
     const report=await this.report(dir.name,file.slice(0,-5))
     if(report.workflowId!==session.workflowId||!report.startedAt||!Number.isFinite(Date.parse(report.startedAt)))throw Error('Invalid run metadata.')
     runs.push({id:report.runId!,recordingId:dir.name,workflowId:report.workflowId!,nodeId:session.nodeId,startedAt:report.startedAt,finishedAt:report.finishedAt??null,state:report.state,verified:report.results?.filter(a=>a.state==='verified').length??0,total:report.total,failureCode:report.failureCode??null,actions:(report.results??[]).map(a=>({sequence:a.sequence,type:a.type,state:a.state})),files:(report.artifacts??[]).map(f=>({id:f.id,name:f.filename,bytes:f.bytes,state:f.state}))})
    }catch{warnings++}
   }catch{warnings++}
  }
  return{runs:runs.sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt)),warnings}
 }
 async artifact(recordingId:string,runId:string,artifactId:string){
  const report=await this.report(recordingId,runId)
  const artifact=report.artifacts?.find(f=>f.id===artifactId&&f.state==='completed')
  if(!artifact)throw Error('Completed file is not registered to this run.')
  const file=await this.inside(artifact.path), downloads=await realpath(join(this.root,recordingId,'downloads'))
  if(!file.startsWith(downloads+sep))throw Error('File is outside this recording.')
  if(!(await stat(file)).isFile())throw Error('Result is not a file.')
  return file
 }
 private async inventory(run:RunSummary){
  const files=run.files.filter(f=>f.name==='nova-restock-inventory.csv'&&f.state==='completed')
  if(files.length!==1)throw Error('This run needs exactly one completed NOVA inventory export for comparison.')
  const path=await this.artifact(run.recordingId,run.id,files[0].id)
  if((await stat(path)).size>2_000_000)throw Error('Inventory exceeds comparison size limit.')
  const rows=parse(await readFile(path,'utf8'),{columns:true,bom:true,skip_empty_lines:true,max_record_size:20000}) as Record<string,string>[]
  if(!rows.length||rows.length>10000)throw Error('Inventory is empty or exceeds the supported row limit.')
  const result=new Map<string,{name:string;stock:number}>()
  for(const row of rows){const id=row['Product ID'],stock=Number(row.Stock);if(!id||!row.Stock?.trim()||!Number.isFinite(stock)||stock<0||result.has(id))throw Error('Inventory has missing, duplicate or invalid product data.');result.set(id,{name:row.Product||id,stock})}
  return result
 }
 async compare(recordingId:string,runId:string):Promise<RunComparison>{
  if(!uuid(recordingId)||!uuid(runId))throw Error('Invalid run reference.')
  const {runs}=await this.list(), current=runs.find(r=>r.id===runId&&r.recordingId===recordingId)
  if(!current)throw Error('Run not found.')
  if(current.state!=='completed')return{baseline:null,rows:[],message:'Comparison requires a successfully completed run.'}
  const baseline=runs.find(r=>r.workflowId===current.workflowId&&r.nodeId===current.nodeId&&r.state==='completed'&&Date.parse(r.startedAt)<Date.parse(current.startedAt))??null
  try{
   const now=await this.inventory(current)
   if(!baseline)return{baseline:null,rows:[...now].map(([id,v])=>({id,name:v.name,previous:null,current:v.stock,delta:null})),message:'Baseline saved. Run this browser task again to compare inventory.'}
   const before=await this.inventory(baseline)
   return{baseline,rows:[...new Set([...now.keys(),...before.keys()])].map(id=>({id,name:now.get(id)?.name??before.get(id)!.name,previous:before.get(id)?.stock??null,current:now.get(id)?.stock??null,delta:now.has(id)&&before.has(id)?now.get(id)!.stock-before.get(id)!.stock:null})),message:'Stock changes from the previous successful run of this browser node. Missing products are shown separately; they are not treated as zero.'}
  }catch(error){return{baseline,rows:[],message:error instanceof Error?error.message:'Inventory comparison unavailable.'}}
 }
}
