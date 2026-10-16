import type { WorkflowSchedule } from '../../../shared/workflowSchedule'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight, LayoutGrid, Plus, RefreshCw, Search, Trash2 } from '../components/ImageIcon'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { AppMark } from '../components/AppMark'
import { DashboardDialog } from '../components/DashboardDialog'
import { TitleBar } from '../components/TitleBar'
import type { SavedWorkflow } from '../../../shared/discovery'
import '../styles/dashboard.css'
import '../styles/workflows.css'

const tabs = { All: undefined, Active: 'ACTIVE', Drafts: 'DRAFT', Archived: 'ARCHIVED' } as const
type Tab = keyof typeof tabs
const pageSize = 20
export function Workflows() {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('All')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SavedWorkflow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deleteRef = useRef(false)
  const [deleteError, setDeleteError] = useState('')
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([])
  const [actionTarget, setActionTarget] = useState<SavedWorkflow | null>(null)
  const [actionMode, setActionMode] = useState<'run' | 'schedule'>('run')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const actionLock = useRef(false)
  useEffect(() => {
    let active = true
    const load = () => { void window.ghost?.automation.list().then(items => { if (active) setSchedules(items) }).catch(cause => { if (active) setActionError(String(cause)) }) }
    load(); const timer = setInterval(load, 5000)
    return () => { active = false; clearInterval(timer) }
  }, [refresh])
  function openAction(workflow: SavedWorkflow, mode: 'run' | 'schedule') { setActionTarget(workflow); setActionMode(mode); setActionError('') }
  async function perform(action: () => Promise<void>) {
    if (actionLock.current) return
    actionLock.current = true; setActionBusy(true); setActionError('')
    try { await action(); setActionTarget(null); setRefresh(value => value + 1) }
    catch (cause) { setActionError(cause instanceof Error ? cause.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '') : 'Action failed.') }
    finally { actionLock.current = false; setActionBusy(false) }
  }
  async function removeWorkflow() {
    if (!deleteTarget || deleteRef.current) return
    deleteRef.current = true; setDeleting(true); setDeleteError('')
    try {
      if (!window.ghost) throw new Error('Open Ghost desktop to delete workflows.')
      const result = await window.ghost.deleteWorkflow(deleteTarget.id)
      if (!result.ok) throw new Error(result.error)
      setDeleteTarget(null); setRefresh(value => value + 1)
    } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'Unable to delete workflow.') }
    finally { deleteRef.current = false; setDeleting(false) }
  }
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const [createError, setCreateError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    const timer = setTimeout(async () => {
      try {
        if (!window.ghost) throw new Error('Open Ghost desktop to load your saved workflows.')
        const result = await window.ghost.listWorkflows(page * pageSize, { limit: pageSize, status: tabs[tab], search: query })
        if (!active) return
        if (!result.ok) throw new Error(result.error)
        if (page > 0 && !result.items.length) { setPage(0); return }
        setWorkflows(result.items); setTotal(result.total)
      } catch (cause) {
        if (active) { setWorkflows([]); setError(cause instanceof Error ? cause.message : 'Unable to load workflows. Please retry.') }
      } finally { if (active) setLoading(false) }
    }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [query, tab, page, refresh])
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (creatingRef.current) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    if (!name) return
    creatingRef.current = true; setCreating(true); setCreateError('')
    try {
      if (!window.ghost) throw new Error('Open Ghost desktop to create a workflow.')
      const result = await window.ghost.createWorkflow({ name, description: String(form.get('description') ?? '').trim() })
      if (!result.ok) throw new Error(result.error)
      setCreateOpen(false); setTab('Drafts'); setQuery(''); setPage(0); setRefresh(value => value + 1)
    } catch (cause) { setCreateError(cause instanceof Error ? cause.message : 'Unable to save this workflow.') }
    finally { creatingRef.current = false; setCreating(false) }
  }
  return <div className="workflows-page">
    <WorkflowSidebar />
    <div className="workflows-page-body"><TitleBar />
    <main className="workflows-page-content"><div className="workflows-page-title"><div><p className="workspace-label">YOUR WORKSPACE</p><h1>Workflows</h1><p>Review your routines, open the canvas, and make them your own.</p></div><button className="dash-button dash-button--primary" onClick={() => { setCreateError(''); setCreateOpen(true) }}><Plus size={16} />New workflow</button></div>
      <section className="dash-panel" aria-label="Your workflows" aria-busy={loading}><div className="workflows-page-filters"><div className="workflow-tabs" aria-label="Filter workflows">{(Object.keys(tabs) as Tab[]).map(item => <button key={item} aria-pressed={tab === item} className={tab === item ? 'is-active' : ''} onClick={() => { setTab(item); setPage(0) }}>{item}</button>)}</div><label className="table-search"><Search size={15} /><input aria-label="Search workflows" placeholder="Search workflows…" maxLength={200} value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} /></label><button className="text-button" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} />Refresh</button></div>
      {loading ? <div className="empty-state" role="status">Loading workflows…</div> : error ? <div className="empty-state" role="alert"><p>{error}</p><button className="dash-button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div> : <>
      <div className="workflow-table-wrap"><table className="workflow-table"><thead><tr><th>Name</th><th>Updated</th><th>Status</th><th>Steps</th><th>Actions</th></tr></thead><tbody>{workflows.map(workflow => <tr key={workflow.id}><td><Link className="workflow-name" to={`/workflows/${workflow.id}`}>{(workflow.applicationIcons?.length ? workflow.applicationIcons : workflow.applications?.length ? workflow.applications : ['Workflow']).slice(0, 3).map(app => <AppMark key={app} app={app} />)}{workflow.name}</Link></td><td>{new Date(workflow.updatedAt).toLocaleString()}</td><td><span className={`status status--${workflow.status.toLowerCase()}`}><span />{workflow.status.charAt(0) + workflow.status.slice(1).toLowerCase()}</span></td><td>{workflow._count.nodes}</td><td><div className="workflow-row-actions"><button className="dash-button dash-button--primary" disabled={schedules.some(s => s.workflowId === workflow.id && s.result === 'Running…')} onClick={() => openAction(workflow, 'run')}>Run</button><button className="dash-button" onClick={() => openAction(workflow, 'schedule')}>Schedule</button><Link className="text-button" to={`/workflows/${workflow.id}`} aria-label={`Open ${workflow.name}`}>Open canvas <ArrowRight size={14} /></Link><button className="text-button workflow-delete" aria-label={`Delete ${workflow.name}`} onClick={() => { setDeleteTarget(workflow); setDeleteError('') }}><Trash2 size={15} />Delete</button></div>{schedules.filter(s => s.workflowId === workflow.id).map(s => <div className="workflow-schedule-summary" key={s.workflowId}>{s.nextRun && <span>Next: {new Date(s.nextRun).toLocaleString()}</span>}{s.result && <span title={s.result}>Last run: {s.result}</span>}</div>)}</td></tr>)}</tbody></table></div>
      {!workflows.length && <div className="empty-state"><LayoutGrid size={24} /><p>{query || tab !== 'All' ? 'No workflows match this view.' : 'No saved workflows yet. Create a workflow or generate one from Home.'}</p></div>}
      <div className="workflows-page-filters"><p className="table-caption">{total} saved workflow{total === 1 ? '' : 's'}</p><button className="text-button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))}</span><button className="text-button" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(value => value + 1)}>Next</button></div>
      </>}</section>
    </main></div>
    {actionError && !actionTarget && <p role="alert">{actionError}</p>}
    {actionTarget && <DashboardDialog title={actionMode === 'run' ? 'Run workflow processing' : 'Schedule workflow processing'} onClose={() => { if (!actionBusy) setActionTarget(null) }}>
      <p className="modal-copy">{actionTarget.name}</p>
      <p className="modal-copy">Runs saved processing logic on the latest verified browser downloads. Browser recordings are not replayed automatically. Run them from the canvas first when you need fresh files.</p>
      {actionError && <p role="alert">{actionError}</p>}
      {actionMode === 'run' ? <button className="dash-button dash-button--primary" disabled={actionBusy} onClick={() => void perform(() => window.ghost!.automation.run(actionTarget.id))}>{actionBusy ? 'Running…' : 'Run now'}</button> : <form className="workflow-form" onSubmit={event => {
        event.preventDefault(); const values = new FormData(event.currentTarget)
        void perform(async () => { await window.ghost!.automation.save({ workflowId: actionTarget.id, nextRun: new Date(String(values.get('start'))).toISOString(), intervalMinutes: Number(values.get('interval')) }) })
      }}>
        <p className="modal-copy">Ghost must be open and this computer awake. Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}. Missed runs execute once when Ghost returns; they do not accumulate.</p>
        <label>Start time<input name="start" type="datetime-local" required disabled={actionBusy} defaultValue={(() => { const saved = schedules.find(s => s.workflowId === actionTarget.id)?.nextRun; const date = saved ? new Date(saved) : new Date(Date.now() + 3600000); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16) })()} /></label>
        <label>Repeat<select name="interval" disabled={actionBusy} defaultValue={schedules.find(s => s.workflowId === actionTarget.id)?.intervalMinutes ?? 1440}><option value="0">Once</option><option value="60">Every hour</option><option value="1440">Every 24 hours</option><option value="10080">Every 7 days</option></select></label>
        <div className="connection-actions"><button className="dash-button dash-button--primary" disabled={actionBusy} type="submit">{actionBusy ? 'Saving…' : 'Save schedule'}</button>{schedules.some(s => s.workflowId === actionTarget.id && s.nextRun) && <button type="button" className="dash-button" disabled={actionBusy} onClick={() => void perform(() => window.ghost!.automation.remove(actionTarget.id))}>Remove schedule</button>}</div>
      </form>}
    </DashboardDialog>}
    {deleteTarget && <DashboardDialog title="Delete workflow?" onClose={() => { if (!deleting) setDeleteTarget(null) }}><p className="modal-copy">Delete “{deleteTarget.name}”? Its saved nodes, connections and backend run history will be permanently removed. Local recording files are kept.</p>{deleteError && <p role="alert">{deleteError}</p>}<div className="connection-actions"><button className="dash-button" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="dash-button workflow-delete" disabled={deleting} onClick={() => void removeWorkflow()}>{deleting ? 'Deleting…' : 'Delete workflow'}</button></div></DashboardDialog>}
    {createOpen && <DashboardDialog title="Create a workflow" onClose={() => { if (!creating) setCreateOpen(false) }}><form className="workflow-form" onSubmit={create}><label>Workflow name<input name="name" required pattern=".*\S.*" maxLength={200} placeholder="e.g. Weekly team update" autoFocus /></label><label>Description<textarea name="description" maxLength={10000} rows={3} placeholder="What would you like to automate?" /></label>{createError && <p role="alert">{createError}</p>}<button disabled={creating} className="dash-button dash-button--primary modal-action" type="submit"><Plus size={16} />{creating ? 'Saving…' : 'Create draft'}</button></form></DashboardDialog>}
  </div>
}
