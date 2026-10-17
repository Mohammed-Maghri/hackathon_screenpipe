import type { WorkflowSchedule } from '../../../shared/workflowSchedule'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight, LayoutGrid, Plus, RefreshCw, Search, Trash2, Workflow } from '../components/ImageIcon'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { AppMark } from '../components/AppMark'
import { DashboardDialog } from '../components/DashboardDialog'
import { TitleBar } from '../components/TitleBar'
import type { SavedWorkflow } from '../../../shared/discovery'

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
  return <div className="workflows-page absolute inset-0 flex overflow-hidden bg-canvas font-sans text-ink">
    <WorkflowSidebar />
    <div className="workflows-page-body min-w-0 flex-1 overflow-auto [scrollbar-gutter:stable] [&>.titlebar]:h-14 [&>.titlebar]:border-b [&>.titlebar]:border-line">{window.ghost?.platform !== 'darwin' && <TitleBar />}
    <main className="workflows-page-content mx-auto max-w-[1600px] p-8 min-[1600px]:p-10 max-[1300px]:p-6 max-[650px]:px-4 max-[650px]:py-6">
      <div className="workflows-page-title mb-6 flex items-center justify-between gap-6 max-[650px]:flex-wrap max-[650px]:gap-5 [&>.dash-button]:shrink-0"><div><p className="workspace-label mb-2 font-mono text-xs leading-relaxed tracking-normal text-muted">Good routines deserve a home.</p><h1 className="mb-2 text-[32px] leading-tight font-medium tracking-tight min-[1600px]:text-4xl max-[650px]:text-[28px]">Your workflows.</h1><p className="text-sm leading-relaxed text-muted">Review your routines, open the canvas, and make them your own.</p></div><button className="dash-button dash-button--primary" onClick={() => { setCreateError(''); setCreateOpen(true) }}><Plus size={16} />New workflow</button></div>
      <div className="workflows-library-summary mb-6 flex items-center gap-3 rounded-card border border-line bg-panel px-4 py-3 max-[650px]:gap-3 max-[650px]:p-3.5"><span className="workflows-summary-icon grid size-8 shrink-0 place-items-center rounded-control border border-line bg-panel text-muted"><Workflow size={20} /></span><p className="flex items-baseline gap-2.5 text-sm max-[650px]:block max-[650px]:text-xs"><strong className="font-mono text-xl font-medium tabular-nums max-[650px]:mr-1">{loading ? '—' : total}</strong> {query || tab !== 'All' ? 'workflows in this view' : 'workflows in your space'}</p><span className="ml-auto font-mono text-xs text-muted max-[1050px]:hidden">Describe, teach, and refine your routines.</span></div>
      <div className="workflows-page-filters mb-4 flex items-center gap-4 max-[1300px]:gap-3 max-[1050px]:flex-wrap"><div className="workflow-tabs flex min-w-0 flex-1 gap-1 border-0 max-[1050px]:basis-full" aria-label="Filter workflows">{(Object.keys(tabs) as Tab[]).map(item => <button key={item} aria-pressed={tab === item} className={`min-h-9 rounded-control border-0 px-3 py-2 font-mono text-xs hover:bg-raised hover:text-ink ${tab === item ? 'is-active bg-sunken font-medium text-ink' : 'text-muted'}`} onClick={() => { setTab(item); setPage(0) }}>{item}</button>)}</div><label className="table-search flex min-h-9 w-60 items-center gap-2 rounded-control border border-line bg-panel px-3 py-2 text-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-action max-[1300px]:w-52 max-[1050px]:w-auto max-[1050px]:flex-1"><Search size={15} /><input className="min-w-0 w-full border-0 bg-transparent font-mono text-xs text-ink outline-none focus-visible:outline-none" type="search" aria-label="Search workflows" placeholder="Find a workflow…" maxLength={200} value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} /></label><button className="text-button workflows-refresh min-h-9 font-mono text-xs" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} />Refresh</button></div>
      {actionError && !actionTarget && <p className="workflows-action-error mb-4 rounded-control border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">{actionError}</p>}
      <section className={`workflows-library ${loading || error || !workflows.length ? 'rounded-card border border-line bg-panel' : ''}`} aria-label="Your workflows" aria-busy={loading}>
        {loading ? <div className="empty-state flex min-h-60 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-sm text-muted [&>p]:m-0 [&>p]:max-w-96 [&>p]:leading-relaxed [&>.dash-button]:mt-2 [&>h2]:mt-1 [&>h2]:text-lg [&>h2]:font-medium [&>h2]:tracking-tight [&>h2]:text-ink" role="status"><RefreshCw size={24} /><p>Loading workflows…</p></div> : error ? <div className="empty-state flex min-h-60 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-sm text-muted [&>p]:m-0 [&>p]:max-w-96 [&>p]:leading-relaxed [&>.dash-button]:mt-2 [&>h2]:mt-1 [&>h2]:text-lg [&>h2]:font-medium [&>h2]:tracking-tight [&>h2]:text-ink" role="alert"><LayoutGrid size={28} /><p>{error}</p><button className="dash-button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div> : <>
          <ul className="workflow-card-grid m-0 grid list-none grid-cols-1 gap-4 p-0 min-[850px]:grid-cols-2 min-[1400px]:grid-cols-3">{workflows.map(workflow => <li className="min-w-0" key={workflow.id}>
            <article className="workflow-library-card group/card relative isolate flex h-full min-h-60 min-w-0 cursor-pointer flex-col rounded-card border border-line bg-panel p-4 transition-colors duration-150 hover:border-strong focus-within:border-strong" aria-label={workflow.name}>
              <header className="flex items-center justify-between gap-3"><span className="workflow-library-node-count inline-flex shrink-0 items-center gap-2 rounded-control border border-strong bg-canvas px-2.5 py-1.5 text-ink"><Workflow size={16} className="text-muted" aria-hidden="true" /><strong className="font-mono text-sm font-semibold tabular-nums">{workflow._count.nodes}</strong><span className="font-sans text-xs">{workflow._count.nodes === 1 ? 'node' : 'nodes'}</span></span><span className={`status status--${workflow.status.toLowerCase()} inline-flex items-center gap-1.5 rounded-control bg-sunken px-2 py-1 font-mono text-xs text-muted whitespace-nowrap [&>span]:size-1.5 [&>span]:rounded-full [&>span]:bg-current`}><span />{workflow.status.charAt(0) + workflow.status.slice(1).toLowerCase()}</span></header>
              <h2 className="mt-4 font-sans text-base font-medium leading-snug tracking-normal"><Link className="workflow-library-title block after:absolute after:inset-0 after:z-0 after:rounded-card after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-3 focus-visible:after:outline-action" to={`/workflows/${workflow.id}`} title={workflow.name}><span className="line-clamp-2 [overflow-wrap:anywhere]">{workflow.name}</span></Link></h2>
              {workflow.description && <p className="workflow-library-description mt-1.5 line-clamp-2 font-sans text-[13px] leading-relaxed text-muted [overflow-wrap:anywhere]" title={workflow.description}>{workflow.description}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="workflow-library-apps flex flex-wrap gap-1 [&>.app-mark]:size-6 [&>.app-mark]:rounded-control" aria-label="Apps">{(workflow.applicationIcons?.length ? workflow.applicationIcons : workflow.applications?.length ? workflow.applications : ['Workflow']).slice(0, 3).map(app => <AppMark key={app} app={app} />)}</div></div>
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">Last edited <time className="tabular-nums" dateTime={workflow.updatedAt} title={new Date(workflow.updatedAt).toLocaleString()}>{new Date(workflow.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(workflow.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</time></p>
              <footer className="mt-auto pt-4"><div className="workflow-card-actions flex flex-wrap items-center gap-2 border-t border-line pt-3 [&>.dash-button]:min-h-9 [&>.dash-button]:px-3 [&>.dash-button]:py-1.5 [&>.dash-button]:text-xs [&>.text-button]:text-xs"><button className="dash-button relative z-10" disabled={schedules.some(s => s.workflowId === workflow.id && s.result === 'Running…')} onClick={() => openAction(workflow, 'run')}>Run</button><button className="text-button relative z-10 min-h-9 px-1" onClick={() => openAction(workflow, 'schedule')}>Schedule</button><Link className="text-button workflow-open relative z-10 ml-auto min-h-9 gap-1.5 rounded-control px-1 hover:bg-sunken" to={`/workflows/${workflow.id}`} aria-label={`Open ${workflow.name}`} title="Open canvas">Open <ArrowRight size={15} /></Link><button className="text-button workflow-delete relative z-10 grid min-h-9 min-w-8 place-items-center rounded-control p-1.5 text-danger hover:bg-danger/10 hover:text-danger" aria-label={`Delete ${workflow.name}`} title="Delete workflow" onClick={() => { setDeleteTarget(workflow); setDeleteError('') }}><Trash2 size={15} /></button></div>{schedules.filter(s => s.workflowId === workflow.id).map(s => <div className="workflow-schedule-summary mt-2 flex min-w-0 flex-col gap-1 font-mono text-xs leading-relaxed text-muted [overflow-wrap:anywhere]" key={s.workflowId}>{s.nextRun && <span>Next: {new Date(s.nextRun).toLocaleString()}</span>}{s.result && <span title={s.result}>Last run: {s.result}</span>}</div>)}</footer>
            </article>
          </li>)}</ul>
          {!workflows.length && <div className="empty-state flex min-h-60 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-sm text-muted [&>p]:m-0 [&>p]:max-w-96 [&>p]:leading-relaxed [&>.dash-button]:mt-2 [&>h2]:mt-1 [&>h2]:text-lg [&>h2]:font-medium [&>h2]:tracking-tight [&>h2]:text-ink"><LayoutGrid size={28} /><h2>{query || tab !== 'All' ? 'No matching workflows' : 'No saved workflows yet'}</h2><p>{query || tab !== 'All' ? 'Try a different search or status filter.' : 'Create a workflow or describe a routine from Home to get started.'}</p>{!query && tab === 'All' && <button className="dash-button" onClick={() => { setCreateError(''); setCreateOpen(true) }}><Plus size={16} />Create a workflow</button>}</div>}
        </>}
      </section>
      {!loading && !error && <div className="workflows-page-pagination mt-4 flex items-center justify-between gap-4 text-muted max-[650px]:flex-col max-[650px]:items-start max-[650px]:gap-2"><p className="table-caption m-0 font-mono text-xs text-muted">{total} saved workflow{total === 1 ? '' : 's'}</p><div className="flex items-center gap-4 font-mono text-xs tabular-nums max-[650px]:w-full max-[650px]:justify-between max-[650px]:gap-2 [&>.text-button]:min-h-9"><button className="text-button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))}</span><button className="text-button" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(value => value + 1)}>Next</button></div></div>}
    </main></div>
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
    {deleteTarget && <DashboardDialog title="Delete workflow?" onClose={() => { if (!deleting) setDeleteTarget(null) }}><p className="modal-copy">Delete “{deleteTarget.name}”? Its saved nodes, connections and backend run history will be permanently removed. Local recording files are kept.</p>{deleteError && <p role="alert">{deleteError}</p>}<div className="connection-actions"><button className="dash-button" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="dash-button workflow-delete text-danger hover:bg-danger/10 hover:text-danger" disabled={deleting} onClick={() => void removeWorkflow()}>{deleting ? 'Deleting…' : 'Delete workflow'}</button></div></DashboardDialog>}
    {createOpen && <DashboardDialog title="Create a workflow" onClose={() => { if (!creating) setCreateOpen(false) }}><form className="workflow-form" onSubmit={create}><label>Workflow name<input name="name" required pattern=".*\S.*" maxLength={200} placeholder="e.g. Weekly team update" autoFocus /></label><label>Description<textarea name="description" maxLength={10000} rows={3} placeholder="What would you like to automate?" /></label>{createError && <p role="alert">{createError}</p>}<button disabled={creating} className="dash-button dash-button--primary modal-action" type="submit"><Plus size={16} />{creating ? 'Saving…' : 'Create draft'}</button></form></DashboardDialog>}
  </div>
}
