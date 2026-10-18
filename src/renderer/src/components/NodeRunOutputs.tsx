import {Fragment,useEffect,useState} from 'react'
import {AppMark} from './AppMark'
import type {NovaRun,NovaAPI} from '../../../shared/novaPipeline'
import '../styles/node-run-outputs.css'
const apps={request:'Screenpipe',browser:'Chrome',calculate:'Excel',report:'Excel',draft:'Slack',review:'Ghost'}
export function NodeRunOutputs({run,api}:{run:NovaRun;api:NovaAPI}){
 const [preview,setPreview]=useState<{name:string;text:string}|null>(null)
 const [step,setStep]=useState(0)
 const [recovered,setRecovered]=useState<unknown>(undefined)
 useEffect(()=>{
  let alive=true;setRecovered(undefined)
  const file=run.files.find(item=>item.name==='browser-exports.json')
  if(file)void api.preview(run.id,file.id).then(text=>{if(alive){try{setRecovered(JSON.parse(text))}catch{setRecovered({file:file.name,preview:text})}}}).catch(()=>{})
  return()=>{alive=false}
 },[api,run.id,run.files.find(item=>item.name==='browser-exports.json')?.id])
 function savedOutput(index:number):unknown{
  const node=run.nodes[index]
  if(!node)return undefined
  if(node.output!==undefined)return node.output
  if(node.operation==='request')return {workflowId:run.workflowId,workflowName:run.workflowName}
  if(node.operation==='browser'&&run.browserRunId)return {browserRunId:run.browserRunId,recordingId:run.recordingId,files:run.sources??[],note:'Recovered from saved browser run references and source files.'}
  if(node.operation==='calculate'&&run.recommendation)return {parsedExports:recovered,settings:run.settings,recommendation:run.recommendation,note:'Recovered from this run’s saved calculation.'}
  if(node.operation==='report'){const files=run.files.filter(file=>/^ghost-nova-/.test(file.name));if(files.length)return {files,recommendation:run.recommendation}}
  if(node.operation==='draft'&&run.draft)return {message:run.draft,sent:run.delivery?.state==='sent',delivery:run.delivery??{state:'not_sent'}}
  if(node.operation==='review'&&(run.state==='needs_review'||run.approvedAt))return {approval:run.approvedAt?'approved':'pending',approvedAt:run.approvedAt,messageSent:run.delivery?.state==='sent'}
  return undefined
 }
 function nodeValue(index:number,side:'input'|'output'){
  const node=run.nodes[index]
  if(side==='output')return savedOutput(index)
  return node.input!==undefined?node.input:index>0?savedOutput(index-1):{workflowId:run.workflowId,workflowName:run.workflowName}
 }
 const [error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function open(id:string,name:string){setBusy(true);setError('');try{if(/\.(json|csv|txt)$/.test(name))setPreview({name,text:await api.preview(run.id,id)});else await api.reveal(run.id,id)}catch(e){setError(e instanceof Error?e.message:'Unable to open output.')}finally{setBusy(false)}}
 return <section className="node-run-outputs"><header><h3>How data moved through this run</h3><p>Inspect each step’s recorded inputs and outputs. Pending steps have no output yet.</p></header>
 <nav className="node-step-selector" aria-label="Run data flow">{run.nodes.map((node,index)=><Fragment key={node.id}><button aria-pressed={step===index} data-state={node.state} title={node.label} onClick={()=>{setStep(index);setPreview(null);setError('')}}><span className="chain-node-top"><AppMark app={apps[node.operation]}/><small>{String(index+1).padStart(2,'0')}</small></span><strong>{node.label}</strong><span className="chain-node-state">{node.state.replaceAll('_',' ')}</span></button>{index<run.nodes.length-1&&<span className="chain-connector" data-ready={savedOutput(index)!==undefined} aria-label={savedOutput(index)!==undefined?'Output feeds the next node':'Waiting for output'}><span/><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4"/></svg></span>}</Fragment>)}</nav>
 <ol>{run.nodes.slice(step,step+1).map((node)=>{const index=step;return <li key={node.id}>
 <article><header><span className="node-run-number">{index+1}</span><AppMark app={apps[node.operation]}/><strong>{node.label}</strong><small data-state={node.state}>{node.state.replaceAll('_',' ')}</small></header>
 <p>{node.detail??(node.state==='pending'?'Waiting for the previous step.':'Executing on this computer…')}</p>
 <div className="node-run-io">{(['input','output'] as const).map(side=><section className="node-io-panel" key={side} aria-label={side==='input'?'Node input':'Node output'}><h4>{side==='input'?'Input':'Output'} <span>{side==='input'&&index>0?'from step '+index:(side==='output'&&index<run.nodes.length-1?'to step '+(index+2):'')}</span></h4>{nodeValue(index,side)!==undefined?<pre tabIndex={0}>{JSON.stringify(nodeValue(index,side),null,2)}</pre>:<p>{node.state==='pending'?'Not available until this step runs.':'No saved data is available for this step in this run.'}</p>}</section>)}</div>
 {run.files.filter(file=>node.outputFileIds?.includes(file.id)||(node.operation==='calculate'&&file.name==='browser-exports.json')||(node.operation==='report'&&/^ghost-nova-/.test(file.name))||(node.operation==='browser'&&run.sources?.some(source=>source.id===file.id))).map(file=><button className="dash-button" disabled={busy} key={file.id} onClick={()=>void open(file.id,file.name)}>{/\.(json|csv|txt)$/.test(file.name)?'View':'Show'} {file.name}</button>)}
 </article>{index<run.nodes.length-1&&<div className="node-run-transfer">↓ {savedOutput(index)===undefined?'Waiting for output':'Output passed as the next step’s input'}</div>}
 </li>})}</ol>
 {error&&<p role="alert">{error}</p>}
 {preview&&<section className="node-output-preview"><header><strong>{preview.name}</strong><button className="text-button" onClick={()=>setPreview(null)}>Close preview</button></header><pre tabIndex={0}>{preview.text}</pre></section>}
 </section>
}
