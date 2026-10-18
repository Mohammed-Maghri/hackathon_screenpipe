import { useEffect, useState } from 'react'
import type { SavedWorkflowDetail } from '../../../shared/discovery'
import type { ScriptPackage } from '../../../shared/workflowScripts'
import { DashboardDialog } from './DashboardDialog'

export function WorkflowScripts({ workflow, nodeId }: { workflow: SavedWorkflowDetail; nodeId?:string }) {
  const [open,setOpen]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('')
  const [pack,setPack]=useState<ScriptPackage|null>(null), [snapshot,setSnapshot]=useState('')
  const [file,setFile]=useState(''), [text,setText]=useState('')
  const current=JSON.stringify(workflow)
  useEffect(()=>{
    if(!open || nodeId || pack || !window.ghost?.scripts)return
    let active=true
    setBusy(true)
    void window.ghost.scripts.latest(workflow.id).then(value=>{if(active)setPack(value)}).catch(reason=>{if(active)setError(String(reason))}).finally(()=>{if(active)setBusy(false)})
    return ()=>{active=false}
  },[open,workflow.id,pack,nodeId])
  useEffect(()=>{
    if(!nodeId)return
    let active=true
    setBusy(true);setError('');setText('');setFile('');setPack(null)
    const prepare=async()=>{
      try {
        const api=window.ghost?.scripts
        if(!api)throw Error('Open Ghost desktop to prepare this local script.')
        const result=await api.generate(JSON.parse(current) as SavedWorkflowDetail)
        const node=result.nodes.find(item=>item.nodeId===nodeId)
        if(!node)throw Error('This node is missing from the generated script package.')
        if(node.status==='blocked')throw Error(node.reason)
        const source=await api.read(result.workflowId,result.revision,node.file)
        if(active){setPack(result);setFile(node.file);setText(source);setSnapshot(current)}
      }catch(reason){if(active)setError(reason instanceof Error?reason.message:'Unable to prepare local script.')}
      finally{if(active)setBusy(false)}
    }
    void prepare()
    return()=>{active=false}
  },[nodeId,current])
  async function generate() {
    setBusy(true);setError('');setText('');setFile('')
    try {
      if (!window.ghost?.scripts) throw Error('Restart Ghost desktop to enable local script generation.')
      const result=await window.ghost.scripts.generate(workflow)
      setPack(result);setSnapshot(current)
      if(nodeId){const node=result.nodes.find(item=>item.nodeId===nodeId);if(node){setFile(node.file);setText(await window.ghost.scripts.read(result.workflowId,result.revision,node.file))}}
    } catch(reason) {setError(reason instanceof Error?reason.message:'Unable to generate local scripts.')}
    finally {setBusy(false)}
  }
  async function preview(name:string) {
    if(!pack)return
    setBusy(true);setError('');setText('');setFile(name)
    try {setText(await window.ghost!.scripts.read(pack.workflowId,pack.revision,name))}
    catch(reason){setError(reason instanceof Error?reason.message:'Unable to read script.')}
    finally{setBusy(false)}
  }
  if(nodeId)return <section className="node-script-preview" aria-busy={busy}>
    <header><strong>Local execution script</strong><span>{busy?'Preparing…':error?'Unavailable':'Prepared on this computer'}</span></header>
    {error?<p role="alert">{error}</p>:busy?<p role="status">Preparing the script for this node…</p>:<>
      <p>Ghost supplies the browser download paths and runs this script locally. The code below opens the files, parses CSV and Excel, and writes browser-exports.json. No manual commands are needed.</p>
      <dl className="node-script-paths"><dt>Runs in</dt><dd>Ghost desktop · local Node.js runtime on this computer</dd><dt>Input location</dt><dd>Registered downloads from the preceding browser node in the current run. Ghost resolves their paths automatically.</dd><dt>Script file</dt><dd>{pack ? `${pack.directory}/${file}` : file}</dd><dt>Output</dt><dd>browser-exports.json in this run’s local results folder</dd></dl>
      <pre tabIndex={0} aria-label="Read-only generated local script">{text}</pre>
      <small>{file}</small>
      {pack&&<small className="node-script-location">Saved locally: {pack.directory}</small>}
    </>}
  </section>
  return <>
    <button className="dash-button" onClick={()=>{setOpen(true);if(nodeId)void generate()}}>{nodeId?'Generate & view local script':'Local scripts'}</button>
    {open&&<DashboardDialog title="Local workflow scripts" onClose={()=>setOpen(false)}>
      <p className="modal-copy">Scripts and their dependency manifest are stored on this computer. The NOVA complete-workflow runner checks and executes its generated modules through Ghost’s local runtime, using verified browser outputs from the same run. Other workflows require their supported runtime adapters. Generating or previewing scripts does not run the workflow.</p>
      <div className="my-4 flex flex-wrap gap-2"><button className="dash-button dash-button--primary" disabled={busy} onClick={()=>void generate()}>{busy?'Working…':pack?'Generate new revision':'Generate scripts'}</button>{pack&&<button className="dash-button" disabled={busy} onClick={()=>void window.ghost?.scripts.reveal(pack.workflowId,pack.revision).catch(reason=>setError(String(reason)))}>Open folder</button>}</div>
      {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
      {pack&&<>
        <p className="modal-copy break-all">Saved: {pack.directory}</p>
        {!snapshot&&<p className="modal-copy">Previously saved revision. Regenerate to capture the current board.</p>}
        {snapshot && snapshot!==current&&<p role="status" className="modal-copy">The board changed. Generate a new revision before using these files.</p>}
        <ul className="my-4 grid gap-2">{pack.nodes.filter(node=>!nodeId||node.nodeId===nodeId).map(node=><li key={node.nodeId} className="rounded-control border border-line p-3"><button disabled={busy} className="text-left text-sm text-action" onClick={()=>void preview(node.file)}>{node.label} · {node.file}</button><p className="mt-1 text-xs text-muted">{node.status==='blocked'?'Needs configuration':'Runtime required'} — {node.reason}</p></li>)}</ul>
        <div className="flex gap-2">{['manifest.json','README.md'].map(name=><button disabled={busy} className="dash-button" key={name} onClick={()=>void preview(name)}>{name}</button>)}</div>
        {file&&<div className="mt-4"><p className="mb-2 text-xs text-muted">{file}</p><pre className="max-h-64 overflow-auto rounded-control border border-line bg-sunken p-3 text-xs whitespace-pre-wrap">{text||'Loading…'}</pre></div>}
      </>}
    </DashboardDialog>}
  </>
}
