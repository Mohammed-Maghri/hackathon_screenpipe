import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { LoaderCircle, RefreshCw, CalendarDays, ArrowDownToLine, ArrowRight, Bell, Check, CircleDot, FileText, LockKeyhole, Plus, Search, Workflow } from '../components/ImageIcon'
import { TitleBar } from '../components/TitleBar'
import { AppMark } from '../components/AppMark'
import { DashboardDialog } from '../components/DashboardDialog'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { sampleActivity } from '../data/workflows'
import { WorkflowTemplates } from '../components/WorkflowTemplates'
import { addWorkflowDraft } from '../data/workflowStore'
import type { SavedWorkflow, DiscoveryRequest } from '../../../shared/discovery'

type Panel = 'create' | 'record' | 'import' | 'integrations' | 'activity' | 'notifications' | 'profile' | 'library' | 'help' | null

export function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
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
  useEffect(() => {
    if (generation) discoveryRef.current?.scrollIntoView({ block: 'start' })
  }, [generation?.phase])
  function review(workflow: SavedWorkflow) { navigate(`/workflows/${workflow.id}`) }
  function addDraft(name: string, description: string, steps: string[] = []) {
    const draft = addWorkflowDraft(name, description, steps)
    navigate(`/workflows/${draft.id}`)
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
  const panelTitles: Record<Exclude<Panel, null>, string> = { create: 'Start with a possibility.', record: 'Your next workflow starts here.', import: 'Bring your workflow along.', integrations: 'Your tools, together.', activity: 'Activity preview', notifications: 'You’re all caught up.', profile: 'Your Ghost workspace.', library: 'Start with a familiar routine.', help: 'Make a little room in your day.' }

  return <div className="dashboard-shell home-dashboard relative flex h-full min-h-0 overflow-hidden bg-canvas font-sans text-ink">
    <WorkflowSidebar active="home" onPanelChange={next => { if (next === 'settings') navigate('/settings', { state: { returnTo: location.pathname, backgroundLocation: location } }); else setPanel(next as Panel) }} />
    <div className="dashboard-body flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="dashboard-topbar relative flex h-14 shrink-0 items-center justify-end gap-4 border-b border-line bg-canvas px-6 max-sm:gap-2 max-sm:px-3 [&:has(.window-controls)]:pr-40 [&>.titlebar]:absolute [&>.titlebar]:inset-0 [&>.titlebar]:z-0 [&>.titlebar]:h-full">
        {window.ghost?.platform !== 'darwin' && <TitleBar />}
        <div className="topbar-context relative z-10 mr-auto font-sans text-sm font-medium text-ink max-sm:hidden"><span>Home</span></div>
        <label className="global-search relative z-10 flex w-[min(320px,44%)] items-center gap-2 rounded-control border border-transparent px-3 py-2 text-muted focus-within:border-action focus-within:ring-3 focus-within:ring-action-soft max-sm:w-auto max-sm:flex-1 max-sm:border-line [-webkit-app-region:no-drag] [&>input]:w-full [&>input]:border-0 [&>input]:bg-transparent [&>input]:font-mono [&>input]:text-xs [&>input]:text-ink [&>input]:outline-none max-sm:[&>input]:text-base [&>kbd]:rounded [&>kbd]:border [&>kbd]:border-line [&>kbd]:bg-canvas [&>kbd]:px-1 [&>kbd]:py-0.5 [&>kbd]:font-mono [&>kbd]:text-[10px] max-sm:[&>kbd]:hidden"><Search size={16} /><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your workflows…" aria-label="Search workflows on this page" /><kbd>{window.ghost?.platform === 'darwin' ? '⌘' : 'Ctrl'} K</kbd></label>
        <button className="notification-button relative z-10 grid size-8 place-items-center rounded-control text-muted hover:bg-sunken hover:text-ink [-webkit-app-region:no-drag]" aria-label="Notifications" onClick={() => setPanel('notifications')}><Bell size={19} /></button>
      </div>
      <main className="home-workspace-content mx-auto flex min-h-0 w-full max-w-[960px] flex-1 flex-col px-8 pb-4 max-[1100px]:px-6 max-sm:px-5 max-sm:pb-3">
        <div className="dashboard-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          <div className="dashboard-grid dashboard-primary min-w-0 pt-10 pb-6 max-[1300px]:pt-7 max-sm:pt-6 [@media(max-height:800px)]:pt-6">
            <header className="dashboard-hero mb-7 text-center max-sm:mb-5"><h1 className="text-2xl font-medium leading-tight tracking-tight max-sm:text-xl">What will you automate next?</h1><p className="mt-2 text-sm leading-relaxed text-muted">Describe a routine, or open a saved workflow to keep going.</p></header>
            <section className="discovery-panel min-w-0" ref={discoveryRef} aria-labelledby="discovery-title" aria-busy={workflowsLoading}>
                <div className="panel-heading mb-3 flex flex-wrap items-center justify-between gap-3 [&>h2]:text-sm [&>h2]:font-medium [&>h2]:tracking-tight max-sm:items-start max-sm:gap-2"><h2 id="discovery-title">Saved workflows</h2><div className="home-workflow-actions ml-auto inline-flex items-center gap-1.5 max-[1300px]:gap-0.5 [&>.text-button]:ml-1 [&>.text-button]:text-xs"><button className="home-icon-button grid h-8 w-7.5 place-items-center rounded-control p-0 text-muted hover:bg-canvas hover:text-action" aria-label="Create workflow draft" title="Create workflow draft" onClick={() => setPanel('create')}><Plus size={16} /></button><button className="home-icon-button grid h-8 w-7.5 place-items-center rounded-control p-0 text-muted hover:bg-canvas hover:text-action" aria-label="Import workflow JSON" title="Import workflow JSON" onClick={() => setPanel('import')}><ArrowDownToLine size={16} /></button><button className="text-button home-icon-button grid h-8 w-7.5 place-items-center rounded-control p-0 text-muted hover:bg-canvas hover:text-action" aria-label="Refresh workflows" title="Refresh workflows" disabled={workflowsLoading || preparing} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} /></button><button className="text-button" onClick={() => navigate('/workflows')}>All workflows <ArrowRight size={14} /></button></div></div>
                <div className="discovery-grid grid grid-cols-2 gap-3 max-[700px]:grid-cols-1">
                  {generation && <article className={`workflow-card generation-card col-span-full rounded-card border p-4 [&>h3]:mb-1.5 [&>h3]:text-base [&>h3]:font-medium ${generation.phase === 'failed' ? 'generation-card--failed border-danger/25 bg-danger/5' : 'border-live/30 bg-live-soft'}`} aria-busy={preparing}>
                    <div className="generation-card-top mb-3 flex items-center justify-between gap-3"><span className="home-workflow-glyph inline-grid size-10 shrink-0 place-items-center rounded-control border border-line bg-canvas text-muted max-[480px]:h-9 max-[480px]:w-8.5"><Workflow size={22} /></span><span className="generation-badge inline-flex border border-line font-mono shrink-0 items-center justify-center gap-1.5 rounded-md bg-canvas px-2 py-1 text-[11px] leading-snug whitespace-nowrap text-muted">{generation.phase === 'failed' ? <CircleDot size={12} /> : <LoaderCircle className="discovery-spinner shrink-0 animate-spin motion-reduce:animate-none" size={12} />}{generation.phase === 'failed' ? 'Needs attention' : 'Generating'}</span></div>
                    <h3>{generation.phase === 'failed' ? 'Let’s try that again' : 'Generating your workflow'}</h3>
                    <p className="generation-request mb-3.5 line-clamp-2 font-mono text-[13px] text-muted [overflow-wrap:anywhere]" title={generation.request.prompt}>{generation.request.prompt}</p>
                    <div className="generation-stages mb-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-muted [&>span]:inline-flex [&>span]:items-center [&>span]:gap-2 [&>p]:leading-relaxed [&>p]:text-danger" role="status" aria-live="polite">{generation.phase === 'failed' ? <p>{generation.error}</p> : <><span className={generation.phase === 'activity' ? 'is-current text-live' : 'is-complete text-muted'}>{generation.phase !== 'activity' ? <Check size={12} /> : <span className="generation-stage-dot mx-0.5 size-1.5 rounded-full bg-current" />}Connect to Screenpipe</span><span className={generation.phase !== 'activity' ? 'is-current text-live' : ''}><span className="generation-stage-dot mx-0.5 size-1.5 rounded-full bg-current" />Analyze & save board</span></>}</div>
                    {generation.phase === 'failed' ? <button className="dash-button" onClick={() => void generateWorkflow(generation.request)}><RefreshCw size={13} />Retry generation</button> : <div className="generation-track h-1 overflow-hidden rounded-full bg-live/15 [&>span]:block [&>span]:h-full [&>span]:w-1/3 [&>span]:animate-pulse [&>span]:rounded-full [&>span]:bg-live motion-reduce:[&>span]:animate-none" aria-hidden="true"><span /></div>}
                    <small className="generation-source mt-2.5 block font-mono text-[11px] text-muted">Screenpipe searches your history · Ghost AI formats the final answer</small>
                  </article>}
                  {!workflowsError && discovered.map(workflow => <article className={`saved-workflow-card min-w-0 ${workflow.id === newWorkflowId ? 'saved-workflow-card--new' : ''}`} key={workflow.id}>
                    <button type="button" className={`dash-button saved-workflow-tile group/card flex h-full min-h-48 w-full flex-col items-stretch justify-start gap-0 rounded-card border-line bg-panel p-4 text-left font-sans font-normal whitespace-normal shadow-none ${workflow.id === newWorkflowId ? 'border-strong' : ''}`} onClick={() => review(workflow)} aria-label={`Open board: ${workflow.name}`} aria-describedby={`home-workflow-description-${workflow.id}`}>
                      <span className="mb-3 flex items-center justify-between gap-3">
                        <span className="home-workflow-node-count inline-flex shrink-0 items-center gap-2 rounded-control border border-strong bg-canvas px-2.5 py-1.5 text-ink"><Workflow size={16} className="text-muted" aria-hidden="true" /><strong className="font-mono text-sm font-semibold tabular-nums">{workflow._count.nodes}</strong><span className="text-xs">{workflow._count.nodes === 1 ? 'node' : 'nodes'}</span></span>
                        <span className={`workflow-status-badge inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control border border-line bg-canvas px-2 py-1 font-mono text-[11px] leading-snug whitespace-nowrap [&>i]:size-1.5 [&>i]:rounded-full [&>i]:bg-current ${workflow.status === 'ACTIVE' ? 'is-active text-success' : 'text-muted'}`}><i aria-hidden="true" />{workflow.id === newWorkflowId ? 'Just created' : workflow.status === 'DRAFT' ? 'Draft' : workflow.status === 'ACTIVE' ? 'Active' : 'Archived'}</span>
                      </span>
                      <span className="saved-workflow-copy mb-4 block min-w-0">
                        <strong className="line-clamp-2 text-sm leading-snug font-medium text-ink [overflow-wrap:anywhere]" title={workflow.name}>{workflow.name}</strong>
                        <span className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted [overflow-wrap:anywhere]" id={`home-workflow-description-${workflow.id}`} title={workflow.description ?? undefined}>{workflow.description || 'No description yet.'}</span>
                      </span>
                      <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
                        <span className="saved-workflow-apps inline-flex shrink-0 items-center gap-1 [&>.app-mark]:size-6">{(workflow.applicationIcons ?? workflow.applications)?.length ? (workflow.applicationIcons ?? workflow.applications)!.slice(0, 3).map(app => <AppMark key={app} app={app} />) : null}</span>
                        <small className="mr-auto font-mono text-[11px] leading-relaxed text-muted">{workflow._count.edges} connection{workflow._count.edges === 1 ? '' : 's'}</small>
                        <ArrowRight className="shrink-0 text-muted transition-colors group-hover/card:text-ink" size={16} aria-hidden="true" />
                      </span>
                    </button>
                  </article>)}
                </div>
                {workflowsLoading && !generation && discovered.length === 0 && <p className="home-list-state m-0 flex min-h-40 flex-col items-center justify-center gap-3 border-b border-line p-6 text-center text-[13px] text-muted" role="status"><LoaderCircle className="discovery-spinner shrink-0 animate-spin motion-reduce:animate-none" size={18} /> Loading workflows…</p>}
                {workflowsError && <div className="home-list-state home-list-error m-0 flex min-h-40 flex-col items-center justify-center gap-3 border-b border-line p-6 text-center text-[13px] text-muted [&>svg]:text-danger [&>h3]:text-base [&>h3]:font-medium [&>h3]:text-ink [&>p]:max-w-96 [&>p]:leading-relaxed" role="alert"><Workflow size={28} /><h3>Couldn’t load your workflows</h3><p>{workflowsError}</p><button className="dash-button" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={14} />Retry</button></div>}
                {!workflowsLoading && !workflowsError && discovered.length === 0 && !generation && <div className="workflow-empty flex min-h-44 flex-col items-center justify-center gap-3.5 border-b border-line px-5 py-7 text-center">
                  <span className="workflow-empty-art grid size-12 place-items-center rounded-card border border-line bg-panel text-muted" aria-hidden="true"><Workflow size={30} /></span>
                  <div className="workflow-empty-copy max-w-90 [&>h3]:mb-1.5 [&>h3]:text-lg [&>h3]:font-medium [&>h3]:leading-snug [&>h3]:tracking-tight [&>p]:text-[13px] [&>p]:leading-relaxed [&>p]:text-muted"><h3>{query ? 'No matching workflows' : 'Start with a routine'}</h3><p>{query ? 'Try a different search, or clear it to see this page’s workflows.' : 'Describe what you do, then review the workflow Ghost creates.'}</p></div>
                  <button className="dash-button workflow-empty-action" onClick={() => { if (query) setQuery(''); else promptRef.current?.focus() }}>{query ? 'Clear search' : 'Describe a workflow'}<ArrowRight size={14} /></button>
                  {!query && <span className="workflow-empty-note font-mono text-[11px] text-muted">Discovery uses your local Screenpipe history.</span>}
                </div>}
                {workflowTotal > 4 && <div className="workflow-pagination flex items-center justify-end gap-4 pt-4 font-mono text-xs text-muted"><button className="text-button" disabled={workflowPage === 0 || preparing} onClick={() => setWorkflowPage(value => value - 1)}>Previous</button><span>Page {workflowPage + 1} of {Math.ceil(workflowTotal / 4)}</span><button className="text-button" disabled={(workflowPage + 1) * 4 >= workflowTotal || preparing} onClick={() => setWorkflowPage(value => value + 1)}>Next</button></div>}
              </section>
          </div>
        </div>
        <div className="home-composer-dock shrink-0 border-t border-line bg-canvas pt-4">
          <div className="home-start-cards mb-3 flex flex-wrap items-center gap-2" aria-label="Start a routine">
            <button className="home-start-card home-card-blue inline-flex min-h-9 items-center gap-2 rounded-control border border-line bg-panel px-3 py-2 text-left font-sans text-[13px] leading-5 text-muted transition-colors hover:border-strong hover:text-ink" onClick={() => promptRef.current?.focus()}><Workflow size={15} /><span>Describe a routine</span></button>
            <button className="home-start-card home-card-peach inline-flex min-h-9 items-center gap-2 rounded-control border border-line bg-panel px-3 py-2 text-left font-sans text-[13px] leading-5 text-muted transition-colors hover:border-strong hover:text-ink" onClick={() => setPanel('record')}><CircleDot size={15} /><span>Record a routine</span></button>
            <button className="home-start-card home-card-lilac inline-flex min-h-9 items-center gap-2 rounded-control border border-line bg-panel px-3 py-2 text-left font-sans text-[13px] leading-5 text-muted transition-colors hover:border-strong hover:text-ink" onClick={() => setPanel('library')}><FileText size={15} /><span>Explore templates</span></button>
          </div>
          <section className="discovery-composer" aria-label="Find a workflow">
            <form className="rounded-card border border-line bg-panel p-4 transition-colors focus-within:border-strong max-sm:p-3" onSubmit={event => { event.preventDefault(); void generateWorkflow({ prompt, timeRange: range }) }}>
              <label className="composer-title sr-only" htmlFor="home-workflow-prompt">What would you like to automate?</label>
              <textarea className="block min-h-18 max-h-40 w-full resize-y rounded-control border-0 bg-transparent p-0 font-mono text-[13px] leading-relaxed text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-action max-sm:min-h-15" id="home-workflow-prompt" ref={promptRef} aria-label="Describe the process to automate" aria-describedby="home-discovery-source" placeholder="Describe a routine you’d like to automate…" disabled={preparing} maxLength={10000} required value={prompt} onChange={event => setPrompt(event.target.value)} />
              <div className="composer-toolbar mt-3 flex flex-wrap items-center gap-3 max-sm:gap-2">
                <label className="range-picker inline-flex min-h-8 items-center gap-1.5 rounded-control border border-line bg-canvas px-2 py-1.5 font-mono text-[11px] text-muted [&>select]:max-w-32 [&>select]:min-w-0 [&>select]:border-0 [&>select]:bg-transparent [&>select]:text-inherit [&_option]:bg-panel [&_option]:text-ink"><CalendarDays size={13} /><select aria-label="Activity time range" disabled={preparing} value={range} onChange={event => setRange(event.target.value as typeof range)}><option>Last 7 days</option><option>Last 24 hours</option><option>Last 30 days</option></select></label>
                <span className="source-label ml-auto font-mono text-[11px] text-muted max-sm:order-last max-sm:ml-0 max-sm:w-full" id="home-discovery-source">Screenpipe activity</span>
                <button className="dash-button dash-button--primary find-workflow min-h-9 text-xs max-sm:ml-auto max-[480px]:px-2.5 max-[480px]:text-[11px]" type="submit" disabled={preparing} aria-busy={preparing}>{preparing ? <><LoaderCircle className="discovery-spinner shrink-0 animate-spin motion-reduce:animate-none" size={16} /> Generating…</> : <>Find my workflow <ArrowRight size={16} /></>}</button>
              </div>
            </form>
            {(preparing || generationMessage) && <div className="discovery-progress mt-2 flex items-center gap-2 font-mono text-xs leading-relaxed text-muted" role="status" aria-live="polite">{preparing ? <><LoaderCircle className="discovery-spinner shrink-0 animate-spin text-live motion-reduce:animate-none" size={14} /><span>{generationStage}</span></> : <span>{generationMessage}</span>}</div>}
            <div className="mt-2 flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
              <details className="prompt-examples text-xs text-muted [&>summary]:w-fit [&>summary]:cursor-pointer [&>summary]:py-1 [&>summary:hover]:text-action [&>div]:flex [&>div]:flex-wrap [&>div]:gap-2 [&>div]:pt-2 [&_button]:inline-flex [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-control [&_button]:border [&_button]:border-line [&_button]:bg-panel [&_button]:px-2.5 [&_button]:py-2 [&_button]:text-left [&_button]:font-sans [&_button]:text-xs [&_button:hover]:border-strong [&_button:hover]:text-ink"><summary>Try an example</summary><div>{['Find my daily reporting process', 'Show how I handle customer follow-ups', 'Create a workflow from my Notion updates'].map(example => <button key={example} disabled={preparing} onClick={() => { setPrompt(example); promptRef.current?.focus() }}>{example}<ArrowRight size={14} /></button>)}</div></details>
              <p className="home-footnote flex items-center gap-1.5 py-1 text-[11px] leading-relaxed text-muted"><LockKeyhole size={12} />Review every workflow before running it.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
    {notice && <div className="dashboard-toast" role="status"><Check size={16} />{notice}</div>}


    {panel && <DashboardDialog title={panelTitles[panel]} onClose={() => setPanel(null)}>
      {panel === 'create' && <form className="workflow-form" onSubmit={createWorkflow}><p className="modal-copy">Give your routine a name. Your draft opens in the editor and stays available for this session.</p><label>Workflow name<input name="name" onInput={event => event.currentTarget.setCustomValidity('')} placeholder="e.g. Weekly team update" required maxLength={80} autoFocus /></label><label>What would you like to automate?<textarea name="description" placeholder="Describe the routine you have in mind…" rows={3} maxLength={300} /></label><button className="dash-button dash-button--primary modal-action" type="submit"><Plus size={16} /> Create draft</button></form>}
      {panel === 'import' && <><p className="modal-copy">Import a local workflow draft. Use a JSON file with a name, an optional description, and an optional list of steps.</p><pre className="import-example">{'{\n  "name": "Weekly report",\n  "steps": ["Collect weekly totals"]\n}'}</pre><label className="file-picker"><ArrowDownToLine size={20} /><span>Choose JSON file</span><input type="file" accept=".json,application/json" onChange={event => void importWorkflow(event.target.files?.[0])} /></label>{importError && <p className="form-error" role="alert">{importError}</p>}<p className="preview-disclosure">Files are read locally. Nothing is uploaded or executed.</p></>}
      {panel === 'record' && <><p className="modal-copy">Open a workflow and choose a browser step to demonstrate your routine in Ghost’s teaching browser.</p><div className="modal-callout"><CircleDot size={23} /><div><strong>No recording in progress</strong><p>Choose a saved workflow, or start by naming a new draft.</p></div></div><div className="modal-action"><button className="dash-button dash-button--primary" onClick={() => navigate('/workflows')}>Browse workflows <ArrowRight size={15} /></button><button className="dash-button" onClick={() => setPanel('create')}>Create a draft <Plus size={15} /></button></div></>}
      {panel === 'integrations' && <><p className="modal-copy">Your workspace is running locally with sample data. No accounts are connected.</p><div className="integration-list">{(['Screenpipe', 'Slack', 'Microsoft', 'Google', 'Notion', 'Excel', 'Gmail', 'Drive', 'Chrome'] as const).map(app => <div key={app}><AppMark app={app} /><strong>{app}</strong><span>Not connected</span></div>)}</div><p className="preview-disclosure">Connection setup will become available when integrations are added.</p></>}
      {panel === 'activity' && <>
        <p className="modal-copy">These example events illustrate the context Screenpipe could provide. Your real activity is not being recorded.</p>
        <div className="mb-5 grid gap-3 sm:grid-cols-2" aria-label="Illustrative workspace overview">
          <section className="home-time-card rounded-card border border-line bg-canvas p-4"><h3 className="text-sm font-medium">Room for better things</h3><div className="home-time-number mt-3 font-mono text-2xl font-medium">8<span className="text-muted">h</span></div><p className="mt-1 text-xs text-muted">back in your week.</p><p className="home-time-caption mt-3 text-xs leading-relaxed text-muted">Illustrative time saved · not measured</p></section>
          <section className="home-workspace-status rounded-card border border-line bg-canvas p-4" aria-label="Sample workspace statistics"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-medium">A little more possibility</h3><span className="home-sample-label text-[11px] text-muted">Sample</span></div><div className="home-sample-stats grid grid-cols-3 gap-3 [&>span]:flex [&>span]:flex-col [&>span]:gap-1 [&>span]:text-[11px] [&>span]:text-muted [&_strong]:font-mono [&_strong]:text-lg [&_strong]:font-medium [&_strong]:text-ink"><span><strong>12</strong>Workflows found</span><span><strong>4</strong>Ready to run</span><span><strong>92%</strong>Success rate (est.)</span></div><p className="home-sample-note mt-3 text-xs leading-relaxed text-muted">Illustrative data, not your workspace totals.</p></section>
        </div>
        <section className="home-activity-panel" aria-label="Sample recent activity"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-medium">Recent activity</h3><span className="home-sample-label text-[11px] text-muted">Sample</span></div><ul className="modal-activity">{sampleActivity.map(activity => <li key={activity.time}><AppMark app={activity.app} /><time>{activity.time}</time><span>{activity.text}</span></li>)}</ul></section>
        <button className="text-button home-manage-connections mt-4" onClick={() => setPanel('integrations')}>Manage connections <ArrowRight size={13} /></button>
      </>}
      {panel === 'notifications' && <><div className="modal-callout"><Bell size={25} /><div><strong>A quiet workspace.</strong><p>No notifications in this preview.</p></div></div><p className="modal-copy">Updates about your workflows will appear here when automation is available.</p></>}
      {panel === 'library' && <WorkflowTemplates />}
      {panel === 'help' && <><p className="modal-copy">Describe a routine on Home to generate a workflow from your Screenpipe history. Open its board to review the steps, teach browser actions, and test the result.</p><p className="preview-disclosure">Screenpipe must be running with the Ghost discovery pipe installed. You can also demonstrate browser steps from an existing workflow.</p><button className="dash-button dash-button--primary modal-action" onClick={() => navigate('/workflows')}>Browse workflows <ArrowRight size={15} /></button></>}
      {panel === 'profile' && <><div className="modal-callout"><span className="avatar">G</span><div><strong>My workspace</strong><p>Local preview · No account required</p></div></div><p className="modal-copy">A little space to explore what Ghost can become. Your current drafts stay in this session.</p></>}
    </DashboardDialog>}
  </div>
}
