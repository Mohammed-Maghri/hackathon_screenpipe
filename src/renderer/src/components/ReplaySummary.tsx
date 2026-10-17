import { useState } from 'react'
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
  return <DashboardDialog title={run.state === 'completed' ? 'Your run is complete' : 'Run results'} onClose={onClose}>
    <div className="run-summary min-w-0 [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-sm [&_h3]:font-medium">
      <p className="modal-copy">{run.state === 'completed' ? 'Review what happened and the files saved by this run.' : 'Review completed work and anything that needs attention.'}</p>
      <div className="run-summary-stats my-5 grid grid-cols-3 gap-2.5 [&>div]:grid [&>div]:gap-1.5 [&>div]:rounded-control [&>div]:border [&>div]:border-line [&>div]:bg-sunken [&>div]:p-3 [&_strong]:font-mono [&_strong]:text-xl [&_strong]:font-medium [&_strong]:text-ink [&_strong]:tabular-nums [&_span]:font-mono [&_span]:text-xs [&_span]:text-muted"><div><strong>{verified}/{results.length}</strong><span>Actions verified</span></div><div><strong>{files.filter(file => file.state === 'completed').length}</strong><span>Files saved</span></div><div><strong>{duration === null ? '—' : `${duration}s`}</strong><span>Duration</span></div></div>
      {run.error && <p role="alert">{run.failureCode}: {run.error}</p>}
      <h3>Saved files</h3>
      {files.length ? <ul className="run-summary-files list-none p-0 [&>li]:mb-2 [&>li]:flex [&>li]:flex-wrap [&>li]:items-center [&>li]:justify-between [&>li]:gap-3 [&>li]:rounded-control [&>li]:border [&>li]:border-line [&>li]:p-3.5 [&_strong]:block [&_strong]:font-medium [&_strong]:break-words [&_small]:block [&_small]:font-mono [&_small]:text-xs [&_small]:break-words [&_small]:text-muted [&_.dash-button]:mt-1 [&_.dash-button]:mr-1">{files.map((file, index) => <li key={`${file.id}-${index}`}><div><strong>{file.filename}</strong><small>{file.state} · {(file.bytes / 1024).toFixed(1)} KB · Action {file.sequence}</small></div>{file.state === 'completed' && <div><button className="dash-button" onClick={() => void fileAction(file.id, file.filename, 'preview')}>Preview</button><button className="dash-button" onClick={() => void fileAction(file.id, file.filename, 'reveal')}>Show in folder</button></div>}</li>)}</ul> : <p className="modal-copy">This run did not download any files.</p>}
      {preview && <section><h4>{preview.name}</h4><pre className="run-file-preview max-h-80 overflow-auto rounded-control border border-line bg-sunken p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-words text-ink">{preview.text}</pre><button className="dash-button" onClick={() => setPreview(null)}>Close preview</button></section>}
      <h3>What happened</h3>
      <ol className="run-summary-actions max-h-64 list-none overflow-auto p-0 [&>li]:border-b [&>li]:border-line [&>li]:py-2.5 [&>li]:text-xs [&_span]:float-right [&_span]:text-muted [&_span[data-state=verified]]:text-success [&_span[data-state=failed]]:text-warning [&_span[data-state=unknown]]:text-warning [&_p]:my-1.5 [&_p]:leading-6 [&_p]:text-muted">{results.map(item => <li key={item.sequence}><strong>#{item.sequence} · {item.type}</strong><span data-state={item.state}>{item.state}</span>{item.evidence && <p>{item.evidence}</p>}</li>)}</ol>
      {error && <p role="alert">{error}</p>}
      <p className="modal-copy">Files and a report of these outcomes are saved locally. Verification describes observed page results, not a guarantee of external business results.</p>
      <button className="dash-button" onClick={() => { void browser?.replayFolder(token).catch(reason => setError(String(reason))) }}>Open saved run folder</button>
      <button className="dash-button dash-button--primary" onClick={onClose}>Back to browser</button>
    </div>
  </DashboardDialog>
}
