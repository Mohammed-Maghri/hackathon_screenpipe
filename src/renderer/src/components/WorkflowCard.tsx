import { ArrowRight, Clock3, MoreHorizontal } from 'lucide-react'
import { AppMark } from './AppMark'
import type { Workflow } from '../data/workflows'
export function WorkflowCard({ workflow, featured, onReview }: { workflow: Workflow; featured: boolean; onReview: () => void }) {
  return <article className={`workflow-card ${featured ? 'workflow-card--featured' : ''}`}>
    <div className="card-apps"><div>{workflow.apps.map(app => <AppMark key={app} app={app} />)}</div><button className="icon-button" aria-label={`Details for ${workflow.name}`} onClick={onReview}><MoreHorizontal size={17} /></button></div>
    <h3>{workflow.name}</h3><p>{workflow.description}</p>
    <span className="seen-count"><Clock3 size={11} /> Seen {workflow.seen} times</span>
    <button className="dash-button dash-button--primary" onClick={onReview}>View & edit <ArrowRight size={14} /></button>
  </article>
}
