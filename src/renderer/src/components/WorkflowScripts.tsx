import { useEffect, useState } from 'react'
import type { SavedWorkflowDetail } from '../../../shared/discovery'
import type { ScriptPackage } from '../../../shared/workflowScripts'
import { DashboardDialog } from './DashboardDialog'

export function WorkflowScripts({ workflow }: { workflow: SavedWorkflowDetail }) {
  const [open,setOpen]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('')
  const [pack,setPack]=useState<ScriptPackage|null>(null), [snapshot,setSnapshot]=useState('')
  const [file,setFile]=useState(''), [text,setText]=useState('')
  const current=JSON.stringify(workflow)
  useEffect(()=>{
    if(!open || pack || !window.ghost?.scripts)return
    let active=true
    setBusy(true)
    void window.ghost.scripts.latest(workflow.id).then(value=>{if(active)setPack(value)}).catch(reason=>{if(active)setError(String(reason))}).finally(()=>{if(active)setBusy(false)})
    return ()=>{active=false}
  },[open,workflow.id,pack])
  async function generate() {
    setBusy(true);setError('');setText('');setFile('')
    try {
      if (!window.ghost?.scripts) throw Error('Restart Ghost desktop to enable local script generation.')
      const result=await window.ghost.scripts.generate(workflow)
      setPack(result);setSnapshot(current)
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
  return <>
    <button className="dash-button" onClick={()=>setOpen(true)}>Local scripts</button>
    {open&&<DashboardDialog title="Local workflow scripts" onClose={()=>setOpen(false)}>
      <p className="modal-copy">Generate a separate module for each node and a manifest of its dependencies, inputs and outputs. Files stay on this device. Existing Run controls continue to use Ghost’s trusted engine; exported modules require runtime adapters and are not executed automatically.</p>
      <div className="my-4 flex flex-wrap gap-2"><button className="dash-button dash-button--primary" disabled={busy} onClick={()=>void generate()}>{busy?'Working…':pack?'Generate new revision':'Generate scripts'}</button>{pack&&<button className="dash-button" disabled={busy} onClick={()=>void window.ghost?.scripts.reveal(pack.workflowId,pack.revision).catch(reason=>setError(String(reason)))}>Open folder</button>}</div>
      {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
      {pack&&<>
        <p className="modal-copy break-all">Saved: {pack.directory}</p>
        {!snapshot&&<p className="modal-copy">Previously saved revision. Regenerate to capture the current board.</p>}
        {snapshot && snapshot!==current&&<p role="status" className="modal-copy">The board changed. Generate a new revision before using these files.</p>}
        <ul className="my-4 grid gap-2">{pack.nodes.map(node=><li key={node.nodeId} className="rounded-control border border-line p-3"><button disabled={busy} className="text-left text-sm text-action" onClick={()=>void preview(node.file)}>{node.label} · {node.file}</button><p className="mt-1 text-xs text-muted">{node.status==='blocked'?'Needs configuration':'Runtime required'} — {node.reason}</p></li>)}</ul>
        <div className="flex gap-2">{['manifest.json','README.md'].map(name=><button disabled={busy} className="dash-button" key={name} onClick={()=>void preview(name)}>{name}</button>)}</div>
        {file&&<div className="mt-4"><p className="mb-2 text-xs text-muted">{file}</p><pre className="max-h-64 overflow-auto rounded-control border border-line bg-sunken p-3 text-xs whitespace-pre-wrap">{text||'Loading…'}</pre></div>}
      </>}
    </DashboardDialog>}
  </>
}
