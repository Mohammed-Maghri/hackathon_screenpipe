import { ActivityTimeline } from '../components/ActivityTimeline'
import { WorkflowNodePreview } from '../components/WorkflowNodePreview'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { LoaderCircle, RefreshCw, CalendarDays, ArrowDownToLine, ArrowRight, Bell, Check, CircleDot, LockKeyhole, Plus, Search, Workflow } from '../components/ImageIcon'
import { TitleBar } from '../components/TitleBar'
import { DashboardDialog } from '../components/DashboardDialog'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { addWorkflowDraft } from '../data/workflowStore'
import type { SavedWorkflow, DiscoveryRequest } from '../../../shared/discovery'

type Panel = 'examples' | 'create' | 'import' | 'notifications' | 'profile' | 'help' | null

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
  const [pageSize, setPageSize] = useState(() => window.innerWidth >= 1200 ? 4 : window.innerWidth >= 900 ? 3 : 2)
  useEffect(() => { const resize = () => { setPageSize(window.innerWidth >= 1200 ? 4 : window.innerWidth >= 900 ? 3 : 2); setWorkflowPage(0) }; window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize) }, [])
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
    void window.ghost.listWorkflows(workflowPage * pageSize, { limit: pageSize }).then(result => {
      if (!active || request !== listRequest.current) return
      if (result.ok) { setSavedWorkflows(result.items); setWorkflowTotal(result.total) }
      else { setSavedWorkflows([]); setWorkflowsError(result.error) }
    }).catch(() => { if (active && request === listRequest.current) { setSavedWorkflows([]); setWorkflowsError('Unable to load workflows. Please retry.') } })
      .finally(() => { if (active && request === listRequest.current) setWorkflowsLoading(false) })
    return () => { active = false }
  }, [workflowPage, refresh, pageSize])
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
      setSavedWorkflows(current => [{ ...workflow, applicationIcons: [...new Set(workflow.nodes.flatMap(node => node.config.stepType === 'browser' ? ['Chrome'] : typeof node.config.application === 'string' ? [node.config.application] : []))], applications: [...new Set(workflow.nodes.flatMap(node => typeof node.config.application === 'string' ? [node.config.application] : []))], _count: { nodes: workflow.nodes.length, edges: workflow.edges.length } }, ...current.filter(item => item.id !== workflow.id)].slice(0, pageSize))
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
  const panelTitles: Record<Exclude<Panel, null>, string> = { examples: 'Try a workflow request', create: 'Start with a possibility.', import: 'Bring your workflow along.', notifications: 'You’re all caught up.', profile: 'Your Ghost workspace.', help: 'Make a little room in your day.' }

  return <div className="dashboard-shell home-dashboard relative flex h-full min-h-0 overflow-hidden bg-canvas font-sans text-ink">
    <WorkflowSidebar active="home" onPanelChange={next => { if (next === 'settings') navigate('/settings', { state: { returnTo: location.pathname, backgroundLocation: location } }); else setPanel(next as Panel) }} />
    <div className="dashboard-body flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="dashboard-topbar relative flex h-14 shrink-0 items-center justify-end gap-4 border-b border-line bg-canvas px-6 max-sm:gap-2 max-sm:px-3 [&:has(.window-controls)]:pr-40 [&>.titlebar]:absolute [&>.titlebar]:inset-0 [&>.titlebar]:z-0 [&>.titlebar]:h-full">
        {window.ghost?.platform !== 'darwin' && <TitleBar />}
        <div className="topbar-context relative z-10 mr-auto font-sans text-sm font-medium text-ink max-sm:hidden"><span>Home</span></div>
        <label className="global-search relative z-10 flex w-[min(320px,44%)] items-center gap-2 rounded-control border border-transparent px-3 py-2 text-muted focus-within:border-action focus-within:ring-3 focus-within:ring-action-soft max-sm:w-auto max-sm:flex-1 max-sm:border-line [-webkit-app-region:no-drag] [&>input]:w-full [&>input]:border-0 [&>input]:bg-transparent [&>input]:font-mono [&>input]:text-xs [&>input]:text-ink [&>input]:outline-none max-sm:[&>input]:text-base [&>kbd]:rounded [&>kbd]:border [&>kbd]:border-line [&>kbd]:bg-canvas [&>kbd]:px-1 [&>kbd]:py-0.5 [&>kbd]:font-mono [&>kbd]:text-[10px] max-sm:[&>kbd]:hidden"><Search size={16} /><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your workflows…" aria-label="Search workflows on this page" /><kbd>{window.ghost?.platform === 'darwin' ? '⌘' : 'Ctrl'} K</kbd></label>
        <button className="notification-button relative z-10 grid size-8 place-items-center rounded-control text-muted hover:bg-sunken hover:text-ink [-webkit-app-region:no-drag]" aria-label="Notifications" onClick={() => setPanel('notifications')}><Bell size={19} /></button>
      </div>
      <main className="home-workspace-content mx-auto flex min-h-0 w-full max-w-[1080px] flex-1 flex-col px-8 pb-4 max-[1100px]:px-6 max-sm:px-5 max-sm:pb-3">
        <div className="dashboard-scroll flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="dashboard-grid dashboard-primary flex min-h-0 flex-1 flex-col gap-2 py-2">
            <header className="dashboard-hero shrink-0 text-left">
              <p className="hidden items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-action"><span className="size-1.5 rounded-full bg-action" aria-hidden="true" />Your Ghost workspace</p>
              <h1 className="max-w-xl text-2xl font-semibold leading-tight tracking-tight max-sm:text-2xl">Less busywork. <span className="text-action">More room for your work.</span></h1>
              <p className="mt-1 max-w-lg text-xs [@media(max-height:850px)]:hidden leading-relaxed text-muted">Describe what you want to automate. Ghost helps you turn your routine into a workflow.</p>
            </header>
        <div className="home-composer-dock min-w-0 shrink-0">
          <section className="discovery-composer" aria-label="Find a workflow">
            <form className="rounded-2xl border border-action/30 bg-panel p-3 shadow-sm transition-shadow hover:border-action-line focus-within:border-action-line focus-within:ring-2 focus-within:ring-action-fill/15 max-sm:p-4" onSubmit={event => { event.preventDefault(); void generateWorkflow({ prompt, timeRange: range }) }}>
              <label className="composer-title sr-only" htmlFor="home-workflow-prompt">What would you like to automate?</label>
              <textarea rows={1} className="block h-8 min-h-6 max-h-12 w-full resize-none rounded-control border-0 bg-transparent p-0 font-sans text-base leading-relaxed text-ink placeholder:text-muted hover:bg-transparent focus:bg-transparent focus-visible:outline-none max-sm:min-h-6" id="home-workflow-prompt" ref={promptRef} aria-label="Describe the process to automate" aria-describedby="home-discovery-source" placeholder="Describe a routine you’d like to automate…" disabled={preparing} maxLength={10000} required value={prompt} onChange={event => setPrompt(event.target.value)} />
              <div className="composer-toolbar mt-2 flex flex-wrap items-center gap-3 max-sm:gap-2">
                <label className="range-picker inline-flex min-h-8 items-center gap-1.5 rounded-control border border-line bg-canvas px-2 py-1.5 font-mono text-[11px] text-muted [&>select]:max-w-32 [&>select]:min-w-0 [&>select]:border-0 [&>select]:bg-transparent [&>select]:text-inherit [&_option]:bg-panel [&_option]:text-ink"><CalendarDays size={13} /><select aria-label="Activity time range" disabled={preparing} value={range} onChange={event => setRange(event.target.value as typeof range)}><option>Last 7 days</option><option>Last 24 hours</option><option>Last 30 days</option></select></label>
                <span className="source-label ml-auto font-mono text-[11px] text-muted max-sm:order-last max-sm:ml-0 max-sm:w-full" id="home-discovery-source">Screenpipe activity</span>
                <button className="dash-button dash-button--primary find-workflow min-h-9 text-xs max-sm:ml-auto max-[480px]:px-2.5 max-[480px]:text-[11px]" type="submit" disabled={preparing} aria-busy={preparing}>{preparing ? <><LoaderCircle className="discovery-spinner shrink-0 animate-spin motion-reduce:animate-none" size={16} /> Generating…</> : <>Find my workflow <ArrowRight size={16} /></>}</button>
              </div>
            </form>
            {(preparing || generationMessage) && <div className="discovery-progress mt-2 flex items-center gap-2 font-mono text-xs leading-relaxed text-muted" role="status" aria-live="polite">{preparing ? <><LoaderCircle className="discovery-spinner shrink-0 animate-spin text-live motion-reduce:animate-none" size={14} /><span>{generationStage}</span></> : <span>{generationMessage}</span>}</div>}
            <div className="mt-2 flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
              <button className="text-button text-[11px]" onClick={() => setPanel('examples')}>Try an example <ArrowRight size={12} /></button>
              <p className="home-footnote flex items-center gap-1.5 py-1 text-[11px] leading-relaxed text-muted"><LockKeyhole size={12} />Review every workflow before running it.</p>
            </div>
          </section>
        </div>
            <section className="discovery-panel flex shrink-0 flex-col" ref={discoveryRef} aria-labelledby="discovery-title" aria-busy={workflowsLoading}>
                <div className="panel-heading mb-3 flex flex-wrap items-center justify-between gap-3 [&>h2]:text-sm [&>h2]:font-medium [&>h2]:tracking-tight max-sm:items-start max-sm:gap-2"><h2 id="discovery-title">Saved workflows</h2><div className="home-workflow-actions ml-auto inline-flex items-center gap-1.5 max-[1300px]:gap-0.5 [&>.text-button]:ml-1 [&>.text-button]:text-xs"><button className="home-icon-button grid h-8 w-7.5 place-items-center rounded-control p-0 text-muted hover:bg-canvas hover:text-action" aria-label="Create workflow draft" title="Create workflow draft" onClick={() => setPanel('create')}><Plus size={16} /></button><button className="home-icon-button grid h-8 w-7.5 place-items-center rounded-control p-0 text-muted hover:bg-canvas hover:text-action" aria-label="Import workflow JSON" title="Import workflow JSON" onClick={() => setPanel('import')}><ArrowDownToLine size={16} /></button><button className="text-button home-icon-button grid h-8 w-7.5 place-items-center rounded-control p-0 text-muted hover:bg-canvas hover:text-action" aria-label="Refresh workflows" title="Refresh workflows" disabled={workflowsLoading || preparing} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} /></button><button className="text-button" onClick={() => navigate('/workflows')}>All workflows <ArrowRight size={14} /></button></div></div>
                <div className="discovery-grid grid gap-3" style={{ gridTemplateColumns: `repeat(${pageSize}, minmax(0, var(--home-card-size)))` }}>
                  {generation && <article className={`workflow-card generation-card col-span-full rounded-card border p-4 [&>h3]:mb-1.5 [&>h3]:text-base [&>h3]:font-medium ${generation.phase === 'failed' ? 'generation-card--failed border-danger/25 bg-danger/5' : 'border-live/30 bg-live-soft'}`} aria-busy={preparing}>
                    <div className="generation-card-top mb-2 flex items-center justify-between gap-3"><span className="home-workflow-glyph inline-grid size-10 shrink-0 place-items-center rounded-control border border-line bg-canvas text-muted max-[480px]:h-9 max-[480px]:w-8.5"><Workflow size={22} /></span><span className="generation-badge inline-flex border border-line font-mono shrink-0 items-center justify-center gap-1.5 rounded-md bg-canvas px-2 py-1 text-[11px] leading-snug whitespace-nowrap text-muted">{generation.phase === 'failed' ? <CircleDot size={12} /> : <LoaderCircle className="discovery-spinner shrink-0 animate-spin motion-reduce:animate-none" size={12} />}{generation.phase === 'failed' ? 'Needs attention' : 'Generating'}</span></div>
                    <h3>{generation.phase === 'failed' ? 'Let’s try that again' : 'Generating your workflow'}</h3>
                    <p className="generation-request mb-3.5 line-clamp-2 font-mono text-[13px] text-muted [overflow-wrap:anywhere]" title={generation.request.prompt}>{generation.request.prompt}</p>
                    <div className="generation-stages mb-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-muted [&>span]:inline-flex [&>span]:items-center [&>span]:gap-2 [&>p]:leading-relaxed [&>p]:text-danger" role="status" aria-live="polite">{generation.phase === 'failed' ? <p>{generation.error}</p> : <><span className={generation.phase === 'activity' ? 'is-current text-live' : 'is-complete text-muted'}>{generation.phase !== 'activity' ? <Check size={12} /> : <span className="generation-stage-dot mx-0.5 size-1.5 rounded-full bg-current" />}Connect to Screenpipe</span><span className={generation.phase !== 'activity' ? 'is-current text-live' : ''}><span className="generation-stage-dot mx-0.5 size-1.5 rounded-full bg-current" />Analyze & save board</span></>}</div>
                    {generation.phase === 'failed' ? <button className="dash-button" onClick={() => void generateWorkflow(generation.request)}><RefreshCw size={13} />Retry generation</button> : <div className="generation-track h-1 overflow-hidden rounded-full bg-live/15 [&>span]:block [&>span]:h-full [&>span]:w-1/3 [&>span]:animate-pulse [&>span]:rounded-full [&>span]:bg-live motion-reduce:[&>span]:animate-none" aria-hidden="true"><span /></div>}
                    <small className="generation-source mt-2.5 block font-mono text-[11px] text-muted">Screenpipe searches your history · Ghost AI formats the final answer</small>
                  </article>}
                  {!workflowsError && !generation && discovered.map(workflow => <article className={`saved-workflow-card min-w-0 ${workflow.id === newWorkflowId ? 'saved-workflow-card--new' : ''}`} key={workflow.id}>
                    <button type="button" className={`dash-button saved-workflow-tile group/card flex aspect-square h-full min-h-0 w-full flex-col items-stretch justify-start gap-0 relative overflow-hidden rounded-card border-action/20 bg-panel p-3 text-left font-sans font-normal whitespace-normal shadow-none transition-all hover:border-action/50 hover:shadow-md focus-visible:outline-action before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-action-fill ${workflow.id === newWorkflowId ? 'border-strong' : ''}`} onClick={() => review(workflow)} aria-label={`Open board: ${workflow.name}`} aria-describedby={`home-workflow-description-${workflow.id}`}>
                      <span className="mb-2 flex items-center justify-between gap-3">
                        <span className="home-workflow-node-count inline-flex shrink-0 items-center gap-2 rounded-control border border-action/20 bg-action-soft px-2 py-1 text-action"><Workflow size={16} className="text-muted" aria-hidden="true" /><strong className="font-mono text-sm font-semibold tabular-nums">{workflow._count.nodes}</strong><span className="text-xs">{workflow._count.nodes === 1 ? 'node' : 'nodes'}</span></span>
                        <span className={`workflow-status-badge inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control border border-line bg-canvas px-2 py-1 font-mono text-[11px] leading-snug whitespace-nowrap [&>i]:size-1.5 [&>i]:rounded-full [&>i]:bg-current ${workflow.status === 'ACTIVE' ? 'is-active text-success' : 'text-muted'}`}><i aria-hidden="true" />{workflow.id === newWorkflowId ? 'Just created' : workflow.status === 'DRAFT' ? 'Draft' : workflow.status === 'ACTIVE' ? 'Active' : 'Archived'}</span>
                      </span>
                      <span className="saved-workflow-copy mb-1 block min-w-0">
                        <strong className="line-clamp-2 text-sm leading-snug font-medium text-ink [overflow-wrap:anywhere]" title={workflow.name}>{workflow.name}</strong>
                        <span className="mt-1.5 line-clamp-1 text-[13px] [@media(max-height:850px)]:hidden leading-5 text-muted [overflow-wrap:anywhere]" id={`home-workflow-description-${workflow.id}`} title={workflow.description ?? undefined}>{workflow.description || 'No description yet.'}</span>
                      </span>
                      <WorkflowNodePreview workflow={workflow} compact />
                      <span className="home-card-footer mt-auto flex items-center justify-end gap-3 pt-1">
                        <small className="hidden font-mono text-[11px] text-muted">{workflow.status === 'ACTIVE' ? 'Active workflow' : 'Make it your routine'}</small>
                        <span className="inline-flex items-center gap-2 rounded-control bg-action-fill px-3 py-2 text-xs font-semibold text-on-action">Open canvas <ArrowRight size={14} aria-hidden="true" /></span>
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
                {workflowTotal > pageSize && <div className="workflow-pagination flex items-center justify-start gap-4 pt-2 font-mono text-xs text-muted"><button className="text-button" disabled={workflowPage === 0 || preparing} onClick={() => setWorkflowPage(value => value - 1)}>Previous</button><span>Page {workflowPage + 1} of {Math.ceil(workflowTotal / pageSize)}</span><button className="text-button" disabled={(workflowPage + 1) * pageSize >= workflowTotal || preparing} onClick={() => setWorkflowPage(value => value + 1)}>Next</button></div>}
              </section>
              <ActivityTimeline busy={preparing} onDiscover={selectedRange => void generateWorkflow({ prompt: prompt.trim() ? prompt : 'Identify the workflow in my recorded activity during the selected time range.', timeRange: 'Last 7 days', selectedRange })} />
          </div>
        </div>
      </main>
    </div>
    {notice && <div className="dashboard-toast" role="status"><Check size={16} />{notice}</div>}


    {panel && <DashboardDialog title={panelTitles[panel]} onClose={() => setPanel(null)}>
      {panel === 'examples' && <div className="grid gap-2">{['Find my daily reporting process', 'Show how I handle customer follow-ups', 'Create a workflow from my Notion updates'].map(example => <button key={example} className="dash-button justify-between text-left whitespace-normal" onClick={() => { setPrompt(example); setPanel(null); requestAnimationFrame(() => promptRef.current?.focus()) }}>{example}<ArrowRight size={14} /></button>)}</div>}
      {panel === 'create' && <form className="workflow-form" onSubmit={createWorkflow}><p className="modal-copy">Give your routine a name. Your draft opens in the editor and stays available for this session.</p><label>Workflow name<input name="name" onInput={event => event.currentTarget.setCustomValidity('')} placeholder="e.g. Weekly team update" required maxLength={80} autoFocus /></label><label>What would you like to automate?<textarea name="description" placeholder="Describe the routine you have in mind…" rows={3} maxLength={300} /></label><button className="dash-button dash-button--primary modal-action" type="submit"><Plus size={16} /> Create draft</button></form>}
      {panel === 'import' && <><p className="modal-copy">Import a local workflow draft. Use a JSON file with a name, an optional description, and an optional list of steps.</p><pre className="import-example">{'{\n  "name": "Weekly report",\n  "steps": ["Collect weekly totals"]\n}'}</pre><label className="file-picker"><ArrowDownToLine size={20} /><span>Choose JSON file</span><input type="file" accept=".json,application/json" onChange={event => void importWorkflow(event.target.files?.[0])} /></label>{importError && <p className="form-error" role="alert">{importError}</p>}<p className="preview-disclosure">Files are read locally. Nothing is uploaded or executed.</p></>}
      {panel === 'notifications' && <><div className="modal-callout"><Bell size={25} /><div><strong>A quiet workspace.</strong><p>No notifications in this preview.</p></div></div><p className="modal-copy">Updates about your workflows will appear here when automation is available.</p></>}
      {panel === 'help' && <><p className="modal-copy">Describe a routine on Home to generate a workflow from your Screenpipe history. Open its board to review the steps, teach browser actions, and test the result.</p><p className="preview-disclosure">Screenpipe must be running with the Ghost discovery pipe installed. You can also demonstrate browser steps from an existing workflow.</p><button className="dash-button dash-button--primary modal-action" onClick={() => navigate('/workflows')}>Browse workflows <ArrowRight size={15} /></button></>}
      {panel === 'profile' && <><div className="modal-callout"><span className="avatar">G</span><div><strong>My workspace</strong><p>Local preview · No account required</p></div></div><p className="modal-copy">A little space to explore what Ghost can become. Your current drafts stay in this session.</p></>}
    </DashboardDialog>}
  </div>
}
