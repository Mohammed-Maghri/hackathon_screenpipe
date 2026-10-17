import { useState } from 'react'
import { Check, Clock3, Download, FileText, FolderOpen, ArrowRight, CircleAlert } from 'lucide-react'
import { GhostLogo } from './GhostLogo'
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
  return <DashboardDialog title={run.state === 'completed' ? 'Your run is complete' : 'Run results'} onClose={onClose} className="run-results-dialog w-[min(760px,calc(100vw-2rem))] max-w-none border-action/25 [&_.eyebrow]:text-action">
    <div className="run-summary min-w-0 [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-sm [&_h3]:font-medium">
      <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${run.state === 'completed' ? 'border-action/25 bg-action-soft/50' : 'border-warning/25 bg-warning/5'}`}>
        <span className="[&_.brand>svg]:h-7 [&_.brand>svg]:w-6 [&_.brand>svg]:text-action-fill [&_.brand>span]:text-xl"><GhostLogo /></span>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${run.state === 'completed' ? 'bg-action-fill text-on-action' : 'bg-panel text-warning'}`}>{run.state === 'completed' ? <Check size={14} /> : <CircleAlert size={14} />}{run.state === 'completed' ? 'Run completed' : run.state.replaceAll('-', ' ')}</span>
      </div>
      <p className="text-sm leading-relaxed text-muted">{run.state === 'completed' ? 'Review what happened and the files saved by this run.' : 'Review completed work and anything that needs attention.'}</p>
      <div className="run-summary-stats my-5 grid grid-cols-3 gap-2.5 max-[420px]:grid-cols-1 [&>div]:grid [&>div]:gap-1.5 [&>div]:rounded-xl [&>div]:border [&>div]:border-line [&>div]:bg-panel [&>div]:p-4 [&_strong]:font-sans [&_strong]:text-xl [&_strong]:font-medium [&_strong]:text-ink [&_strong]:tabular-nums [&_span]:font-sans [&_span]:text-xs [&_span]:text-muted"><div><Check size={17} className="text-action" /><strong>{verified}/{results.length}</strong><span>Actions verified</span></div><div><Download size={17} className="text-action" /><strong>{files.filter(file => file.state === 'completed').length}</strong><span>Files saved</span></div><div><Clock3 size={17} className="text-action" /><strong>{duration === null ? '—' : `${duration}s`}</strong><span>Duration</span></div></div>
      {run.error && <p className="my-3 rounded-lg border border-danger/25 bg-danger/5 p-3 text-sm text-danger break-words" role="alert">{run.failureCode}: {run.error}</p>}
      <h3>Saved files</h3>
      {files.length ? <ul className="run-summary-files list-none p-0 [&>li]:mb-2 [&>li]:flex [&>li]:flex-wrap [&>li]:items-center [&>li]:justify-between [&>li]:gap-3 [&>li]:rounded-control [&>li]:border [&>li]:border-line [&>li]:p-3.5 [&>li]:bg-panel [&>li]:min-w-0 [&_strong]:block [&_strong]:font-medium [&_strong]:break-words [&_small]:block [&_small]:font-sans [&_small]:text-xs [&_small]:break-words [&_small]:text-muted [&_.dash-button]:mt-1 [&_.dash-button]:mr-1">{files.map((file, index) => <li key={`${file.id}-${index}`}><div className="min-w-0 flex-1"><FileText size={18} className="mb-2 text-action" /><strong>{file.filename}</strong><small>{file.state} · {(file.bytes / 1024).toFixed(1)} KB · Action {file.sequence}</small></div>{file.state === 'completed' && <div><button className="dash-button border-action/25 bg-action-soft text-action" onClick={() => void fileAction(file.id, file.filename, 'preview')}>Preview</button><button className="dash-button" onClick={() => void fileAction(file.id, file.filename, 'reveal')}>Show in folder</button></div>}</li>)}</ul> : <p className="rounded-xl border border-dashed border-line bg-sunken/40 p-5 text-center text-sm text-muted">No files were downloaded during this run.</p>}
      {preview && <section><h4>{preview.name}</h4><pre className="run-file-preview max-h-80 overflow-auto rounded-control border border-line bg-sunken p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-words text-ink">{preview.text}</pre><button className="dash-button" onClick={() => setPreview(null)}>Close preview</button></section>}
      <h3>What happened</h3>
      <ol className="run-summary-actions max-h-64 list-none overflow-auto p-0 [&>li]:border-b [&>li]:border-line [&>li]:py-2.5 [&>li]:text-xs [&_span]:ml-3 [&_span]:inline-flex [&_span]:rounded-full [&_span]:bg-sunken [&_span]:px-2 [&_span]:py-0.5 [&_span]:text-muted [&_span[data-state=verified]]:text-action [&_span[data-state=verified]]:bg-action-soft [&_span[data-state=failed]]:text-warning [&_span[data-state=unknown]]:text-warning [&_p]:my-1.5 [&_p]:leading-6 [&_p]:text-muted">{results.map(item => <li key={item.sequence}><strong>#{item.sequence} · {item.type}</strong><span data-state={item.state}>{item.state}</span>{item.evidence && <p>{item.evidence}</p>}</li>)}</ol>
      {error && <p className="my-3 rounded-lg border border-danger/25 bg-danger/5 p-3 text-sm text-danger break-words" role="alert">{error}</p>}
      <p className="mt-5 text-xs leading-relaxed text-muted">Files and a report of these outcomes are saved locally. Verification describes observed page results, not a guarantee of external business results.</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><button className="dash-button" onClick={() => { void browser?.replayFolder(token).catch(reason => setError(String(reason))) }}><FolderOpen size={15} />Open saved run folder</button>
      <button className="dash-button dash-button--primary" onClick={onClose}>Back to browser <ArrowRight size={15} /></button></div>
    </div>
  </DashboardDialog>
}
