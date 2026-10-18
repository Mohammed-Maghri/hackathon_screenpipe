import { useState } from 'react'
import { Check, Clock3, Download, FileText, FolderOpen, ArrowRight, CircleAlert } from 'lucide-react'
import '../styles/replay-summary.css'
import type { ReplayStatus } from '../../../shared/recording'
import type { TeachingBrowser } from '../../../shared/browser'
import { DashboardDialog } from './DashboardDialog'

export function ReplaySummary({ run, browser, token, onClose }: { run: ReplayStatus; browser?: TeachingBrowser; token: string; onClose: () => void }) {
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null)
  const [error, setError] = useState('')
  const files = run.artifacts ?? []
  const results = run.results ?? []
  const verified = results.filter(item => item.state === 'verified').length
  const duration = run.finishedAt && run.startedAt ? Math.max(0, Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000)) : null
  async function fileAction(id: string, name: string, action: 'preview' | 'reveal') {
    try {
      setError('')
      const text = await browser?.replayArtifact(token, run.runId!, id, action)
      if (action === 'preview') setPreview({ name, text: text ?? '' })
    } catch (reason) { setError(String(reason)) }
  }
  const saved = files.filter(file => file.state === 'completed').length
  const attention = results.filter(item => ['failed','unknown','needs-user-approval'].includes(item.state))
  return <DashboardDialog title={run.state === 'completed' ? 'Browser step complete' : 'Browser step needs attention'} onClose={onClose} className="run-results-dialog">
    <div className="run-summary">
      <p className="run-outcome">{run.state === 'completed'
        ? `${verified} of ${results.length} actions verified. ${saved ? `${saved} file${saved === 1 ? '' : 's'} saved for you to review.` : 'No files were downloaded.'}`
        : `Run ${run.state.replaceAll('-', ' ')}. ${verified} of ${results.length} actions verified. Review the issue before running again.`}</p>
      <p className="run-outcome">This summary covers the browser step only. Run the full workflow from the board to convert its exports and generate the buying report.</p>
      <div className="run-summary-stats"><div><Check size={14}/><strong>{verified}/{results.length}</strong><span>Verified</span></div><div><Download size={14}/><strong>{saved}</strong><span>Files saved</span></div><div><Clock3 size={14}/><strong>{duration === null ? '—' : `${duration}s`}</strong><span>Duration</span></div></div>
      {(run.error || attention.length > 0) && <div className="run-attention" role="alert"><CircleAlert size={16}/><p>{run.error || `${attention.length} actions need review. Open action details below.`}{run.failureCode && <small>{run.failureCode}</small>}</p></div>}
      <div className="run-summary-content">
        <h3>Files from this run</h3>
        {files.length ? <ul className="run-summary-files">{files.map((file,index)=><li key={`${file.id}-${index}`}><FileText size={17}/><div><strong>{file.filename}</strong><small>{file.state} · {(file.bytes/1024).toFixed(1)} KB</small></div>{file.state==='completed'&&<div className="run-file-actions"><button className="dash-button" disabled={!browser} onClick={()=>void fileAction(file.id,file.filename,'preview')}>Preview</button><button className="text-button" disabled={!browser} onClick={()=>void fileAction(file.id,file.filename,'reveal')}>Show in folder</button></div>}</li>)}</ul>:<p className="run-empty-files">This run produced no downloadable files. You can review the actions below or return to the website.</p>}
        {preview&&<section className="run-preview"><header><strong>{preview.name}</strong><button className="text-button" onClick={()=>setPreview(null)}>Close preview</button></header><pre className="run-file-preview">{preview.text}</pre></section>}
        <details className="run-action-details"><summary>Action details <span>{results.length} actions{attention.length?` · ${attention.length} need review`:''}</span></summary><ol className="run-summary-actions">{results.map(item=><li key={item.sequence}><strong>#{item.sequence} · {item.type}</strong><span data-state={item.state}>{item.state}</span>{item.evidence&&<p>{item.evidence}</p>}</li>)}</ol><p className="run-verification-note">Verification reflects observed page results. It does not confirm external business outcomes.</p></details>
      </div>
      {error&&<p className="run-attention" role="alert">{error}</p>}
      <footer className="run-summary-footer"><button className="dash-button" disabled={!browser} onClick={()=>{void browser?.replayFolder(token).catch(reason=>setError(String(reason)))}}><FolderOpen size={15}/>Run folder</button><button className="dash-button dash-button--primary" onClick={onClose}>Back to browser <ArrowRight size={15}/></button></footer>
    </div>
  </DashboardDialog>
}
