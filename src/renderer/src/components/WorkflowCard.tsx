import { ArrowRight, Clock3, MoreHorizontal } from './ImageIcon'
import { AppMark } from './AppMark'
import type { Workflow } from '../data/workflows'
export function WorkflowCard({ workflow, featured, onReview }: { workflow: Workflow; featured: boolean; onReview: () => void }) {
  return <article className={`workflow-card flex min-w-0 flex-col rounded-card border p-4 ${featured ? 'workflow-card--featured border-strong bg-panel' : 'border-line bg-panel'}`}>
    <div className="card-apps mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-1.5">{workflow.apps.map(app => <AppMark key={app} app={app} />)}</div><button className="icon-button" aria-label={`Details for ${workflow.name}`} onClick={onReview}><MoreHorizontal size={17} /></button></div>
    <h3 className="mb-1.5 text-sm font-medium leading-snug tracking-tight">{workflow.name}</h3><p className="mb-3 text-[13px] leading-relaxed text-muted">{workflow.description}</p>
    <span className="seen-count mt-auto mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-muted"><Clock3 size={11} /> Seen {workflow.seen} times</span>
    <button className="dash-button dash-button--primary" onClick={onReview}>View & edit <ArrowRight size={14} /></button>
  </article>
}
