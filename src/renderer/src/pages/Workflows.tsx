import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight, LayoutGrid, Plus, Search, Workflow as WorkflowIcon } from 'lucide-react'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { AppMark } from '../components/AppMark'
import { DashboardDialog } from '../components/DashboardDialog'
import { TitleBar } from '../components/TitleBar'
import { addWorkflowDraft, useWorkflows } from '../data/workflowStore'
import '../styles/dashboard.css'
import '../styles/workflows.css'


type Tab = 'All' | 'Active' | 'Scheduled' | 'Drafts'
export function Workflows() {
  const workflows = useWorkflows()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('All')
  const [createOpen, setCreateOpen] = useState(false)
  const visible = workflows.filter(workflow => `${workflow.name} ${workflow.apps.join(' ')}`.toLowerCase().includes(query.toLowerCase()) && (tab === 'All' || (tab === 'Active' && workflow.status === 'Success') || (tab === 'Scheduled' && workflow.nextRun !== '—') || (tab === 'Drafts' && workflow.status === 'Draft')))
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    if (!name) return
    addWorkflowDraft(name, String(form.get('description') ?? '').trim())
    setCreateOpen(false); setTab('Drafts'); setQuery('')
  }
  return <div className="workflows-page">
    <WorkflowSidebar />
    <div className="workflows-page-body"><TitleBar />
    <main className="workflows-page-content"><div className="workflows-page-title"><div><p className="workspace-label">YOUR WORKSPACE</p><h1>Workflows</h1><p>Review your routines, open the canvas, and make them your own.</p></div><button className="dash-button dash-button--primary" onClick={() => setCreateOpen(true)}><Plus size={16} />New workflow</button></div>
      <section className="dash-panel" aria-label="Your workflows"><div className="workflows-page-filters"><div className="workflow-tabs" aria-label="Filter workflows">{(['All', 'Active', 'Scheduled', 'Drafts'] as const).map(item => <button key={item} aria-pressed={tab === item} className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div><label className="table-search"><Search size={15} /><input aria-label="Search workflows" placeholder="Search workflows…" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      <div className="workflow-table-wrap"><table className="workflow-table"><thead><tr><th>Name</th><th>Last run</th><th>Status</th><th>Next run</th><th><span className="sr-only">Open editor</span></th></tr></thead><tbody>{visible.map(workflow => <tr key={workflow.id}><td><Link className="workflow-name" to={`/workflows/${workflow.id}`}>{workflow.apps[0] ? <AppMark app={workflow.apps[0]} /> : <span className="app-mark"><WorkflowIcon size={16} /></span>}{workflow.name}</Link></td><td>{workflow.lastRun}</td><td><span className={`status status--${workflow.status.toLowerCase().replace(' ', '-')}`}><span />{workflow.status}</span></td><td>{workflow.nextRun}</td><td><Link className="text-button" to={`/workflows/${workflow.id}`} aria-label={`Open ${workflow.name}`}>Open canvas <ArrowRight size={14} /></Link></td></tr>)}</tbody></table></div>
      {!visible.length && <div className="empty-state"><LayoutGrid size={24} /><p>No workflows match this view.</p></div>}<p className="table-caption">Sample runs and schedules · Drafts remain available until you reload the app.</p></section>
    </main></div>
    {createOpen && <DashboardDialog title="Create a workflow" onClose={() => setCreateOpen(false)}><form className="workflow-form" onSubmit={create}><label>Workflow name<input name="name" required pattern=".*\S.*" maxLength={80} placeholder="e.g. Weekly team update" autoFocus /></label><label>Description<textarea name="description" maxLength={300} rows={3} placeholder="What would you like to automate?" /></label><button className="dash-button dash-button--primary modal-action" type="submit"><Plus size={16} />Create draft</button></form></DashboardDialog>}
  </div>
}
