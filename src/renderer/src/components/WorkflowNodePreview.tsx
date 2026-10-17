import { AppMark } from './AppMark'
import type { SavedWorkflow } from '../../../shared/discovery'

/** A preview of the apps declared by this workflow, not a claimed execution order. */
export function WorkflowNodePreview({ workflow, compact = false }: { workflow: SavedWorkflow; compact?: boolean }) {
  const apps = [...new Set([...(workflow.applicationIcons ?? []), ...(workflow.applications ?? [])])]
    .filter(Boolean).filter((app, index, all) => all.findIndex(other => other.toLowerCase() === app.toLowerCase()) === index)
  const shown = apps.slice(0, 4)
  if (compact) return <span className="saved-workflow-apps mb-2 flex min-w-0 items-center gap-2 overflow-hidden" aria-label="Workflow applications">{shown.map(app => <span key={app} title={app} className="inline-flex shrink-0 items-center rounded-md border border-line bg-canvas p-1 [&_.app-mark]:size-5"><AppMark app={app} /></span>)}</span>
  return <span className="workflow-node-preview mb-3 block rounded-xl border border-action/15 bg-action-soft/40 p-2.5">
    <span className="mb-2 flex items-center justify-between gap-2"><span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-action">In this workflow</span><span className="font-mono text-[10px] tabular-nums text-muted">{workflow._count.edges} connection{workflow._count.edges === 1 ? '' : 's'}</span></span>
    {shown.length ? <span className="saved-workflow-apps workflow-library-apps grid grid-cols-2 gap-1.5">{shown.map(app => <span key={app} className="flex min-w-0 items-center gap-2 rounded-lg border border-action/10 bg-panel/90 px-2 py-1.5 [&>.app-mark]:size-6" title={app}>
      <AppMark app={app} /><span className="min-w-0 truncate text-xs font-medium text-ink">{/^(chrome|google chrome|browser)$/i.test(app) ? 'Browser' : app}</span>
    </span>)}{apps.length > shown.length && <span className="col-span-2 font-mono text-[10px] text-muted">+{apps.length - shown.length} more apps in the canvas</span>}</span> : <span className="block text-xs leading-relaxed text-muted">{workflow._count.nodes ? 'Open the canvas to explore its steps.' : 'Add your first step in the canvas.'}</span>}
  </span>
}
