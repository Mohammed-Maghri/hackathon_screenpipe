import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { LoaderCircle, RefreshCw, CalendarDays, ArrowDownToLine, ArrowRight, Bell, Check, ChevronRight, Circle, CircleDot, Home, LayoutGrid, Library, Plus, Search, Settings, Unplug } from '../components/ImageIcon'
import { GhostLogo } from '../components/GhostLogo'
import { TitleBar } from '../components/TitleBar'
import { AppMark } from '../components/AppMark'
import { DashboardDialog } from '../components/DashboardDialog'
import { sampleActivity, sampleWorkflows } from '../data/workflows'
import { addWorkflowDraft } from '../data/workflowStore'
import type { SavedWorkflow, DiscoveryRequest } from '../../../shared/discovery'
import landscape from '../assets/landscape.png'
import workflowsImage from '../assets/workflow-imagery/workflows.png'
import readyImage from '../assets/workflow-imagery/ready.png'
import timeImage from '../assets/workflow-imagery/time.png'
import successImage from '../assets/workflow-imagery/success.png'
import workflowEmptyImage from '../assets/workflow-imagery/workflow-empty.png'
import '../styles/dashboard.css'

type Panel = 'create' | 'record' | 'import' | 'integrations' | 'settings' | 'activity' | 'notifications' | 'profile' | 'library' | null
const navItems = [{ label: 'Home', icon: Home }, { label: 'Workflows', icon: LayoutGrid }, { label: 'Record', icon: CircleDot }, { label: 'Library', icon: Library }, { label: 'Integrations', icon: Unplug }, { label: 'Settings', icon: Settings }]

export function Dashboard() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [range, setRange] = useState<import('../../../shared/discovery').DiscoveryRequest['timeRange']>('Last 7 days')
  const [preparing, setPreparing] = useState(false)
  const [generationStage, setGenerationStage] = useState('')
  const [generation, setGeneration] = useState<{ request: DiscoveryRequest; phase: 'activity' | 'ai' | 'saving' | 'failed'; error?: string } | null>(null)
  const [newWorkflowId, setNewWorkflowId] = useState('')
  const generationRequest = useRef<{ signature: string; id: string } | null>(null)
  const preparingRef = useRef(false)
  const [generationMessage, setGenerationMessage] = useState('')
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([])
  const [workflowsLoading, setWorkflowsLoading] = useState(true)
  const [workflowsError, setWorkflowsError] = useState('')
  const [workflowPage, setWorkflowPage] = useState(0)
  const [workflowTotal, setWorkflowTotal] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const listRequest = useRef(0)
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState<Panel>(null)
  const [activeNav, setActiveNav] = useState('Home')
  const [notice, setNotice] = useState('')
  const [importError, setImportError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const discoveryRef = useRef<HTMLElement>(null)
  const discovered = savedWorkflows.filter(workflow => `${workflow.name} ${workflow.description ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  useEffect(() => {
    let active = true
    const request = ++listRequest.current
    setWorkflowsLoading(true)
    setWorkflowsError('')
    if (!window.ghost) {
      setWorkflowsError('Open the desktop app to load your saved workflows.')
      setWorkflowsLoading(false)
      return
    }
    void window.ghost.listWorkflows(workflowPage * 4).then(result => {
      if (!active || request !== listRequest.current) return
      if (result.ok) { setSavedWorkflows(result.items); setWorkflowTotal(result.total) }
      else { setSavedWorkflows([]); setWorkflowsError(result.error) }
    }).catch(() => { if (active && request === listRequest.current) { setSavedWorkflows([]); setWorkflowsError('Unable to load workflows. Please retry.') } })
      .finally(() => { if (active && request === listRequest.current) setWorkflowsLoading(false) })
    return () => { active = false }
  }, [workflowPage, refresh])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus() } }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 4500); return () => window.clearTimeout(timer) }, [notice])
  useEffect(() => window.ghost?.onDiscoveryProgress(progress => {
    if (progress.requestId !== generationRequest.current?.id) return
    setGeneration(current => current && current.phase !== 'failed' ? { ...current, phase: progress.phase } : current)
    setGenerationStage({ activity: 'Checking Screenpipe discovery…', ai: 'Screenpipe AI is identifying your workflow…', saving: 'Formatting with Ghost AI and saving your board…' }[progress.phase])
  }), [])
  async function generateWorkflow(request: DiscoveryRequest) {
    if (!request.prompt.trim() || preparingRef.current) return
    if (!window.ghost) { setGenerationMessage('Open Ghost in the desktop app to connect to the backend.'); return }
    preparingRef.current = true
    setPreparing(true)
    setGenerationMessage('')
    setWorkflowPage(0)
    setQuery('')
    setGeneration({ request, phase: 'activity' })
    setGenerationStage('Checking Screenpipe discovery…')
    const fail = (error: string) => { setGeneration({ request, phase: 'failed', error }); setGenerationMessage('') }
    try {
      const signature = JSON.stringify(request)
      if (generationRequest.current?.signature !== signature) generationRequest.current = { signature, id: crypto.randomUUID() }
      const result = await window.ghost.discoverWorkflow({ ...request, requestId: generationRequest.current.id })
      if (!result.ok) { fail(result.error); return }
      const workflow = result.workflow
      listRequest.current++
      setWorkflowsLoading(false)
      setSavedWorkflows(current => [{ ...workflow, applicationIcons: [...new Set(workflow.nodes.flatMap(node => node.config.stepType === 'browser' ? ['Chrome'] : typeof node.config.application === 'string' ? [node.config.application] : []))], applications: [...new Set(workflow.nodes.flatMap(node => typeof node.config.application === 'string' ? [node.config.application] : []))], _count: { nodes: workflow.nodes.length, edges: workflow.edges.length } }, ...current.filter(item => item.id !== workflow.id)].slice(0, 4))
      setWorkflowTotal(current => current + 1)
      setWorkflowsError('')
      setNewWorkflowId(workflow.id)
      setRefresh(value => value + 1)
      setGeneration(null)
      generationRequest.current = null
      navigate(`/workflows/${workflow.id}`)
    } catch { fail('Unable to generate this workflow. Retry to recover any saved result.') }
    finally { preparingRef.current = false; setPreparing(false) }
  }
  function review(workflow: SavedWorkflow) { navigate(`/workflows/${workflow.id}`) }
  function addDraft(name: string, description: string, steps: string[] = []) {
    addWorkflowDraft(name, description, steps)
    navigate('/workflows')
  }
  function createWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    if (!name) {
      const input = event.currentTarget.elements.namedItem('name') as HTMLInputElement
      input.setCustomValidity('Enter a workflow name.'); input.reportValidity(); return
    }
    addDraft(name, String(form.get('description') ?? '').trim())
  }
  async function importWorkflow(file?: File) {
    if (!file) return
    setImportError('')
    try {
      if (file.size > 100_000) throw new Error('Choose a JSON file smaller than 100 KB.')
      const value: unknown = JSON.parse(await file.text())
      if (!value || typeof value !== 'object' || !('name' in value) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80) throw new Error('Include a name between 1 and 80 characters.')
      const record = value as Record<string, unknown>
      if (record.steps !== undefined && (!Array.isArray(record.steps) || record.steps.length > 20 || !record.steps.every(step => typeof step === 'string' && step.length <= 500))) throw new Error('Steps must be an array of up to 20 short text instructions.')
      if (record.description !== undefined && (typeof record.description !== 'string' || record.description.length > 300)) throw new Error('Description must be text up to 300 characters.')
      addDraft(value.name.trim(), typeof record.description === 'string' ? record.description : '', Array.isArray(record.steps) ? record.steps as string[] : [])
    } catch (error) { setImportError(error instanceof SyntaxError ? 'This file is not valid JSON.' : error instanceof Error ? error.message : 'Unable to read this file.') }
  }
  function navigateSection(label: string) {
    if (label === 'Home') { setActiveNav(label); document.querySelector('.dashboard-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }); return }
    if (label === 'Workflows') { navigate('/workflows'); return }
    const panels: Record<string, Panel> = { Record: 'record', Library: 'library', Integrations: 'integrations', Settings: 'settings' }
    setPanel(panels[label] ?? null)
  }
  const panelTitles: Record<Exclude<Panel, null>, string> = { create: 'Start with a possibility.', record: 'Your next workflow starts here.', import: 'Bring your workflow along.', integrations: 'Your tools, together.', settings: 'A workspace that feels like you.', activity: 'A little context goes a long way.', notifications: 'You’re all caught up.', profile: 'Your Ghost workspace.', library: 'Start with a familiar routine.' }

  return <div className="dashboard-shell home-dashboard">
    <aside className="dashboard-sidebar">
      <div className="sidebar-art" style={{ backgroundImage: `url(${landscape})` }} aria-hidden="true" />
      <button className="sidebar-brand" aria-label="Go to home" onClick={() => navigateSection('Home')}><GhostLogo /></button>
      <nav aria-label="Main navigation">{navItems.map(({ label, icon: Icon }) => <button key={label} aria-label={label} title={label} className={activeNav === label ? 'nav-item is-active' : 'nav-item'} onClick={() => navigateSection(label)} aria-current={activeNav === label ? 'page' : undefined}><Icon size={19} strokeWidth={1.6} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-message">Turn<br />repetitive work<br />into freedom.<i /></div><button className="profile-button" onClick={() => setPanel('profile')}><span className="avatar">G</span><span>My workspace<small>Local preview</small></span><ChevronRight size={16} /></button></div>
    </aside>
    <div className="dashboard-body">
      <div className="dashboard-topbar"><TitleBar /><label className="global-search"><Search size={16} /><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search workflows, activity, or anything..." aria-label="Search workflows and apps" /><kbd>{window.ghost?.platform === 'darwin' ? '⌘' : 'Ctrl'} K</kbd></label><button className="notification-button" aria-label="Notifications" onClick={() => setPanel('notifications')}><Bell size={21} /></button></div>
      <div className="dashboard-scroll">
        <motion.main className="dashboard-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <header className="dashboard-hero"><img src={landscape} alt="" aria-hidden="true" /><div><p className="workspace-label">POWERED BY SCREENPIPE</p><h1>What would you like<br />to <span>automate</span> today?</h1><p>Describe the process you do, and Screenpipe will search your recorded activity,<br className="desktop-break" /> find the relevant steps, and turn it into a workflow.</p></div><blockquote>“ Your computer<br />&nbsp; remembers.<br />&nbsp; Let’s make it work<br />&nbsp; for you.”<i /></blockquote></header>
          <div className="dashboard-grid"><div className="dashboard-primary">
            <section className="discovery-composer" aria-label="Find a workflow">
              <form onSubmit={event => { event.preventDefault(); void generateWorkflow({ prompt, timeRange: range }) }}>
                <textarea ref={promptRef} aria-label="Describe the process to automate" placeholder="What would you like to automate?" disabled={preparing} maxLength={10000} required value={prompt} onChange={event => setPrompt(event.target.value)} />
                <div className="composer-toolbar"><label className="range-picker"><CalendarDays size={15} /><select aria-label="Activity time range" disabled={preparing} value={range} onChange={event => setRange(event.target.value as typeof range)}><option>Last 7 days</option><option>Last 24 hours</option><option>Last 30 days</option></select></label><span className="source-label"><span className="source-dot" />Screenpipe</span><button className="dash-button dash-button--primary find-workflow" type="submit" disabled={preparing} aria-busy={preparing}>{preparing ? <><LoaderCircle className="discovery-spinner" size={16} /> Generating…</> : <>Find my workflow <ArrowRight size={16} /></>}</button></div>
              </form>
              {(preparing || generationMessage) && <div className="discovery-progress" role="status" aria-live="polite">{preparing ? <><LoaderCircle className="discovery-spinner" size={16} /><span>{generationStage}</span></> : <span>{generationMessage}</span>}</div>}
              <p className="examples-label">Try an example</p><div className="prompt-examples">{['Find my daily reporting process', 'Show how I handle customer follow-ups', 'Create a workflow from my Notion updates'].map(example => <button key={example} disabled={preparing} onClick={() => setPrompt(example)}>“{example}”<ArrowRight size={16} /></button>)}</div>
            </section>
            <section className="dash-panel discovery-panel" ref={discoveryRef} aria-labelledby="discovery-title" aria-busy={workflowsLoading}>
              <div className="panel-heading"><div><h2 id="discovery-title">Your workflows</h2><p>Your routines, ready to take shape.</p></div><button className="text-button" disabled={workflowsLoading || preparing} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={13} /> Refresh</button></div>
              <div className="discovery-grid">
                {generation && <article className={`workflow-card generation-card ${generation.phase === 'failed' ? 'generation-card--failed' : ''}`} aria-busy={preparing}>
                  <div className="generation-card-top"><img src={workflowEmptyImage} alt="" /><span className="generation-badge">{generation.phase === 'failed' ? <CircleDot size={12} /> : <LoaderCircle className="discovery-spinner" size={12} />}{generation.phase === 'failed' ? 'Needs attention' : 'Generating'}</span></div>
                  <h3>{generation.phase === 'failed' ? 'Let’s try that again' : 'Your workflow is taking shape'}</h3>
                  <p className="generation-request" title={generation.request.prompt}>{generation.request.prompt}</p>
                  <div className="generation-stages" role="status" aria-live="polite">{generation.phase === 'failed' ? <p>{generation.error}</p> : <><span className={generation.phase === 'activity' ? 'is-current' : 'is-complete'}>{generation.phase !== 'activity' ? <Check size={12} /> : <span className="generation-stage-dot" />}Connect to Screenpipe</span><span className={generation.phase !== 'activity' ? 'is-current' : ''}><span className="generation-stage-dot" />Analyze & save board</span></>}</div>
                  {generation.phase === 'failed' ? <button className="dash-button" onClick={() => void generateWorkflow(generation.request)}><RefreshCw size={13} />Retry generation</button> : <div className="generation-track" aria-hidden="true"><span /></div>}
                  <small className="generation-source">Screenpipe searches your history · Ghost AI formats the final answer</small>
                </article>}
                {!workflowsError && discovered.map(workflow => <article className={`workflow-card saved-workflow-card ${workflow.id === newWorkflowId ? 'saved-workflow-card--new' : ''}`} key={workflow.id}><div className="card-apps"><div className="saved-workflow-apps">{(workflow.applicationIcons ?? workflow.applications)?.length ? (workflow.applicationIcons ?? workflow.applications)!.slice(0, 3).map(app => <AppMark key={app} app={app} />) : <img className="saved-workflow-image" src={workflowsImage} alt="" />}</div><span className="workflow-status-badge">{workflow.id === newWorkflowId ? 'Just created' : workflow.status === 'DRAFT' ? 'Draft' : workflow.status === 'ACTIVE' ? 'Active' : 'Archived'}</span></div><h3>{workflow.name}</h3><p>{workflow.description || 'No description yet.'}</p><span className="seen-count">{workflow._count.nodes} nodes · {workflow._count.edges} connections</span><button className="dash-button dash-button--primary" onClick={() => review(workflow)}>Open board <ArrowRight size={14} /></button></article>)}
              </div>
              {workflowsLoading && !generation && discovered.length === 0 && <p className="empty-state" role="status"><LoaderCircle className="discovery-spinner" size={16} /> Loading workflows…</p>}
              {workflowsError && <div className="empty-state" role="alert"><p>{workflowsError}</p><button className="dash-button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
              {!workflowsLoading && !workflowsError && discovered.length === 0 && !generation && <div className="workflow-empty">
                <div className="workflow-empty-art" aria-hidden="true"><img src={workflowEmptyImage} alt="" /></div>
                <div className="workflow-empty-copy"><h3>{query ? 'No matching workflows' : 'A little less busywork starts here.'}</h3><p>{query ? 'Try a different search, or clear it to see this page’s workflows.' : 'No saved workflows yet. Start with a routine you’d like to automate.'}</p></div>
                <button className="dash-button workflow-empty-action" onClick={() => { if (query) setQuery(''); else promptRef.current?.focus() }}>{query ? 'Clear search' : 'Describe a workflow'}<ArrowRight size={14} /></button>
                {!query && <span className="workflow-empty-note">Development mode · uses synthetic activity.</span>}
              </div>}
              {workflowTotal > 4 && <div className="workflow-pagination"><button className="text-button" disabled={workflowPage === 0 || preparing} onClick={() => setWorkflowPage(value => value - 1)}>Previous</button><span>Page {workflowPage + 1} of {Math.ceil(workflowTotal / 4)}</span><button className="text-button" disabled={(workflowPage + 1) * 4 >= workflowTotal || preparing} onClick={() => setWorkflowPage(value => value + 1)}>Next</button></div>}
            </section>

          </div>
          <aside className="dashboard-secondary" aria-label="Workspace overview">
            <section className="dash-panel connection-panel"><div className="connection-heading"><span className="connection-indicator"><Circle size={18} /></span><div><h2>Screenpipe <span className="connection-status-dot" /></h2><strong>Preview mode</strong><p>Sample activity · not connected</p></div></div><div className="connection-actions"><button className="dash-button" onClick={() => setPanel('integrations')}>Manage</button><button className="dash-button" onClick={() => setPanel('activity')}>View activity <ArrowRight size={13} /></button></div></section>
            <section className="dash-panel stats-panel" aria-label="Sample workspace statistics">{[{ image: workflowsImage, value: '12', label: 'Workflows found' }, { image: readyImage, value: '4', label: 'Ready to run' }, { image: timeImage, value: '8h', label: 'Time saved (est.)' }, { image: successImage, value: '92%', label: 'Success rate (est.)' }].map(({ image, value, label }) => <div className="stat" key={label}><span className="stat-art"><img src={image} alt="" /></span><div><strong>{value}</strong><small>{label}</small></div></div>)}<p>Illustrative data</p></section>
            <section className="dash-panel activity-panel"><div className="activity-heading"><h2>Recent activity</h2><button className="text-button" onClick={() => setPanel('activity')}>View all <ArrowRight size={14} /></button></div><ul>{sampleActivity.map(activity => <li key={activity.time}><AppMark app={activity.app} /><time>{activity.time}</time><span>{activity.text}</span></li>)}</ul></section>
          </aside></div>
        </motion.main>
      </div>
    </div>
    {notice && <div className="dashboard-toast" role="status"><Check size={16} />{notice}</div>}


    {panel && <DashboardDialog title={panelTitles[panel]} onClose={() => setPanel(null)}>
      {panel === 'create' && <form className="workflow-form" onSubmit={createWorkflow}><p className="modal-copy">Give your routine a name. Your draft will appear in this session’s workflow list.</p><label>Workflow name<input name="name" onInput={event => event.currentTarget.setCustomValidity('')} placeholder="e.g. Weekly team update" required maxLength={80} autoFocus /></label><label>What would you like to automate?<textarea name="description" placeholder="Describe the routine you have in mind…" rows={3} maxLength={300} /></label><button className="dash-button dash-button--primary modal-action" type="submit"><Plus size={16} /> Create draft</button></form>}
      {panel === 'import' && <><p className="modal-copy">Import a local workflow draft. Use a JSON file with a name, an optional description, and an optional list of steps.</p><pre className="import-example">{'{\n  "name": "Weekly report",\n  "steps": ["Collect weekly totals"]\n}'}</pre><label className="file-picker"><ArrowDownToLine size={20} /><span>Choose JSON file</span><input type="file" accept=".json,application/json" onChange={event => void importWorkflow(event.target.files?.[0])} /></label>{importError && <p className="form-error" role="alert">{importError}</p>}<p className="preview-disclosure">Files are read locally. Nothing is uploaded or executed.</p></>}
      {panel === 'record' && <><p className="modal-copy">Recording will let you demonstrate a routine and turn its steps into a workflow. Screen capture is not available in this preview.</p><div className="modal-callout"><CircleDot size={23} /><div><strong>No recording in progress</strong><p>You can start by naming a workflow draft.</p></div></div><button className="dash-button dash-button--primary modal-action" onClick={() => setPanel('create')}>Create a draft instead <ArrowRight size={15} /></button></>}
      {panel === 'integrations' && <><p className="modal-copy">Your workspace is running locally with sample data. No accounts are connected.</p><div className="integration-list">{(['Screenpipe', 'Slack', 'Microsoft', 'Google', 'Notion', 'Excel', 'Gmail', 'Drive', 'Chrome'] as const).map(app => <div key={app}><AppMark app={app} /><strong>{app}</strong><span>Not connected</span></div>)}</div><p className="preview-disclosure">Connection setup will become available when integrations are added.</p></>}
      {panel === 'activity' && <><p className="modal-copy">These example events illustrate the context Screenpipe could provide. Your real activity is not being recorded.</p><ul className="modal-activity">{sampleActivity.map(activity => <li key={activity.time}><AppMark app={activity.app} /><time>{activity.time}</time><span>{activity.text}</span></li>)}</ul></>}
      {panel === 'notifications' && <><div className="modal-callout"><Bell size={25} /><div><strong>A quiet workspace.</strong><p>No notifications in this preview.</p></div></div><p className="modal-copy">Updates about your workflows will appear here when automation is available.</p></>}
      {panel === 'library' && <><p className="modal-copy">Choose an example to make it your own. Templates are saved as drafts for this session.</p><div className="template-list">{sampleWorkflows.slice(0, 3).map(workflow => <button key={workflow.id} onClick={() => addDraft(workflow.name, workflow.description, workflow.steps)}><span><strong>{workflow.name}</strong><small>{workflow.steps.length} steps</small></span><Plus size={18} /></button>)}</div></>}
      {panel === 'settings' && <><div className="settings-row"><span>Appearance</span><strong>Ghost dark</strong></div><div className="settings-row"><span>Data source</span><strong>Local sample data</strong></div><div className="settings-row"><span>Version</span><strong>0.1.0</strong></div><p className="preview-disclosure">No data is sent to external services. Drafts remain available across pages until you reload the app.</p><button className="dash-button modal-action" onClick={() => navigate('/')}>Back to welcome <ArrowRight size={15} /></button></>}
      {panel === 'profile' && <><div className="modal-callout"><span className="avatar">G</span><div><strong>My workspace</strong><p>Local preview · No account required</p></div></div><p className="modal-copy">A little space to explore what Ghost can become. Your current drafts stay in this session.</p></>}
    </DashboardDialog>}
  </div>
}
