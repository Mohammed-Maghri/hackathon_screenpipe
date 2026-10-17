import { useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router'
import { Bug, ChevronDown, ChevronRight, ChevronUp, CircleDot, CircleHelp, Library, ListTree, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plug, Plus, Settings, TimerReset, UsersRound, Workflow } from 'lucide-react'
import { AppMark } from './AppMark'
import { DashboardDialog } from './DashboardDialog'
import { WorkflowTemplates } from './WorkflowTemplates'
import { WorkspaceChromeContext } from './WorkspaceFrame'
import { useWorkflows } from '../data/workflowStore'
import type { SavedWorkflow } from '../../../shared/discovery'

const items = [
  { label: 'Home', icon: Plus, to: '/dashboard', key: 'home' },
  { label: 'Workflows', icon: TimerReset, to: '/workflows', key: 'workflows' },
  { label: 'Record a routine', icon: CircleDot, to: null, key: 'record' },
  { label: 'Templates', icon: Library, to: null, key: 'library' },
  { label: 'Activity', icon: ListTree, to: null, key: 'activity' },
  { label: 'Connections', icon: Plug, to: null, key: 'integrations' },
]
const panelTitles: Record<string, string> = { record: 'Record a routine', library: 'Workflow templates', activity: 'Recent activity', integrations: 'Connections', profile: 'My workspace', help: 'A little help', menu: 'Workspace', switcher: 'Ghost workspace', diagnostics: 'Diagnostics' }
const collapsedKey = 'ghost.sidebar.collapsed'
const navItem = 'nav-item relative flex h-8 min-w-0 items-center gap-2 rounded-control border border-transparent px-2.5 text-left font-sans text-[13px] font-semibold leading-5 text-sidebar-muted transition-colors hover:bg-nav-active hover:text-sidebar-ink focus-visible:outline-2 focus-visible:outline-action aria-[current=page]:border-sidebar-selected-line aria-[current=page]:bg-nav-active aria-[current=page]:text-sidebar-ink aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-1 aria-[current=page]:before:left-0 aria-[current=page]:before:w-0.5 aria-[current=page]:before:bg-sidebar-indicator'
const utilityButton = 'app-no-drag relative inline-grid size-7 shrink-0 place-items-center rounded-sm text-sidebar-muted transition-colors hover:bg-nav-active hover:text-sidebar-ink'

function relativeDate(value?: string) {
  if (!value) return ''
  const elapsed = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(elapsed)) return ''
  const minutes = Math.max(1, Math.floor(elapsed / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

export function WorkflowSidebar({ active = 'workflows', onPanelChange }: { active?: 'home' | 'workflows'; onPanelChange?: (panel: string) => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const localWorkflows = useWorkflows()
  const [panel, setPanel] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(collapsedKey) === 'true' } catch { return false }
  })
  const [recent, setRecent] = useState<SavedWorkflow[]>([])
  const [recentState, setRecentState] = useState<'loading' | 'ready' | 'error'>(window.ghost ? 'loading' : 'ready')
  const openPanel = (key: string) => {
    if (key === 'settings') { setPanel(null); navigate('/settings', { state: { returnTo: location.pathname + location.search, backgroundLocation: location } }); return }
    if (onPanelChange) onPanelChange(key)
    else setPanel(key)
  }
  const compact = collapsed ? 'w-14' : 'w-60'
  const hideLabel = collapsed ? 'hidden' : 'max-lg:hidden'
  const centerOnRail = collapsed ? 'justify-center px-0' : 'max-lg:justify-center max-lg:px-0'
  const desktopMac = window.ghost?.platform === 'darwin'
  const chromeControls = useContext(WorkspaceChromeContext)
  const drafts = localWorkflows.filter(item => !item.persisted && /^[a-f\d-]{36}$/i.test(item.id)).slice().reverse()
  const recentItems = [...drafts.map(item => ({ id: item.id, name: item.name, app: item.apps[0], updatedAt: undefined as string | undefined, draft: true })), ...recent.map(item => ({ id: item.id, name: item.name, app: item.applicationIcons?.[0] ?? item.applications?.[0], updatedAt: item.updatedAt, draft: false }))].filter((item, index, list) => list.findIndex(other => other.id === item.id) === index).slice(0, 5)

  useEffect(() => {
    let current = true
    if (!window.ghost) return
    void window.ghost.listWorkflows(0, { limit: 5 }).then(result => {
      if (!current) return
      if (result.ok) { setRecent(result.items); setRecentState('ready') }
      else setRecentState('error')
    }).catch(() => { if (current) setRecentState('error') })
    return () => { current = false }
  }, [location.pathname])

  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(collapsedKey, String(next)) } catch { /* Keep the in-memory choice when storage is unavailable. */ }
  }
  function choosePanel(key: string) { setPanel(null); openPanel(key) }

  const toolbar = <div className={`sidebar-toolbar relative flex h-8 shrink-0 items-center px-1.5 ${desktopMac ? 'gap-1' : `max-lg:justify-center ${collapsed ? 'justify-center' : ''}`}`}>
    {!desktopMac && <div className="app-drag absolute inset-0" aria-hidden="true" />}
    <button type="button" className={utilityButton} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={toggleSidebar} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
    <button type="button" className={`${utilityButton} ${desktopMac ? '' : collapsed ? 'hidden' : 'max-lg:hidden'}`} aria-label="Workspace menu" aria-haspopup="dialog" onClick={() => setPanel('menu')} title="Workspace menu"><MoreHorizontal size={14} /></button>
    {!desktopMac && <span className={`mx-2 size-2 shrink-0 rounded-full bg-sidebar-ink ${hideLabel}`} title="Local workspace" aria-label="Local workspace" />}
  </div>

  return <>
    {desktopMac && chromeControls && createPortal(toolbar, chromeControls)}
    <aside aria-label="Workflow sidebar" className={`dashboard-sidebar editor-sidebar relative flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-sidebar-line bg-sidebar text-sidebar-ink ${compact} max-lg:w-14`}>
      {!desktopMac && toolbar}

      <button type="button" className={`sidebar-context app-no-drag flex h-14 shrink-0 items-center gap-2 px-5 text-left font-sans text-lg font-semibold ${centerOnRail}`} aria-label="Ghost workspace" aria-haspopup="dialog" onClick={() => setPanel('switcher')} title="Ghost workspace">
        <Workflow size={18} strokeWidth={1.8} /><span className={`min-w-0 flex-1 ${hideLabel}`}>Workflows</span><ChevronDown className={`mr-1 ${hideLabel}`} size={14} />
      </button>

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <nav className="sidebar-primary-nav ml-1 mt-1 grid gap-0.5 border-b border-sidebar-line pb-2 [&>.nav-item]:mr-2" aria-label="Main navigation">
          {items.map(({ label, icon: Icon, key, to }) => to ? <Link key={key} to={to} onClick={() => { if (key === 'home' && active === 'home') document.querySelector('.dashboard-scroll')?.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }} title={label} aria-label={label} className={`${navItem} ${centerOnRail} ${key === active ? 'is-active' : ''}`} aria-current={key === active ? 'page' : undefined}><Icon size={16} strokeWidth={1.8} /><span className={hideLabel}>{label}</span></Link> : <button type="button" key={key} className={`${navItem} ${centerOnRail}`} title={label} aria-label={label} onClick={() => openPanel(key)}><Icon size={16} strokeWidth={1.8} /><span className={hideLabel}>{label}</span></button>)}
        </nav>

        <section className={`sidebar-recents pt-3 ${hideLabel}`} aria-labelledby="sidebar-recents-heading">
          <div className="flex h-5 items-center gap-1 px-3.5 font-sans text-[11px] font-semibold text-sidebar-muted">
            <h2 id="sidebar-recents-heading" className="min-w-0 flex-1 text-[11px] font-semibold tracking-normal">Recents</h2>
            <button type="button" className="grid size-5 place-items-center rounded-sm hover:bg-nav-active hover:text-sidebar-ink" aria-label="Recent workflow options" onClick={() => setPanel('menu')}><MoreHorizontal size={13} /></button>
            <Link to="/workflows" className="inline-flex items-center gap-1 whitespace-nowrap hover:text-sidebar-ink" aria-label="View all workflows">View all <ChevronRight size={12} /></Link>
          </div>
          <div className="mt-1 px-2">
            {recentItems.map(item => <Link key={item.id} to={`/workflows/${item.id}`} title={item.name} aria-label={`Open recent workflow: ${item.name}`} className="sidebar-recent-row flex h-7 min-w-0 items-center gap-2.5 rounded-sm pl-2 pr-3 font-sans text-xs font-medium text-sidebar-muted hover:bg-nav-active hover:text-sidebar-ink [&_.app-mark]:size-[17px] [&_.app-mark]:rounded-sm [&_.app-mark]:border-0 [&_.app-mark]:p-0">
              {item.app ? <AppMark app={item.app} /> : <Workflow size={17} strokeWidth={1.5} />}
              <span className="min-w-0 flex-1 truncate">{item.name}</span><span className="shrink-0 text-[10px] tabular-nums">{item.draft ? 'Draft' : relativeDate(item.updatedAt)}</span>
            </Link>)}
            {recentItems.length === 0 && <p className="px-2 py-2 text-[11px] leading-5 text-sidebar-muted" role={recentState === 'loading' ? 'status' : undefined}>{recentState === 'loading' ? 'Loading workflows…' : recentState === 'error' ? 'Recent workflows unavailable.' : 'Opened and saved workflows appear here.'}</p>}
          </div>
          <Link to="/workflows" className="sidebar-automations flex h-7 items-center justify-between px-3.5 font-sans text-[11px] font-semibold text-sidebar-muted hover:text-sidebar-ink" title="Browse workflows and schedules"><span>Automations</span><TimerReset size={12} /></Link>
        </section>
      </div>

      <footer className="sidebar-footer mx-1 shrink-0 border-t border-sidebar-line pb-1">
        <button type="button" className={`profile-button flex h-10 w-full items-center gap-3 px-2.5 text-left font-sans text-[13px] font-semibold text-sidebar-muted hover:text-sidebar-ink ${centerOnRail}`} title="My workspace" aria-label="My workspace" onClick={() => openPanel('profile')}><UsersRound size={15} strokeWidth={1.7} /><span className={`min-w-0 flex-1 ${hideLabel}`}>My workspace</span><ChevronUp className={`mr-1 ${hideLabel}`} size={12} /></button>
        <div className="flex h-9 items-center">
          <button type="button" className={`sidebar-settings flex h-9 min-w-0 flex-1 items-center gap-3 px-2.5 text-left font-sans text-[13px] font-semibold text-sidebar-muted hover:text-sidebar-ink ${centerOnRail}`} title="Settings" aria-label="Settings" onClick={() => openPanel('settings')}><Settings size={15} strokeWidth={1.7} /><span className={hideLabel}>Settings</span></button>
          {!collapsed && <button type="button" className={`${utilityButton} mr-2 max-lg:hidden`} title="Diagnostics" aria-label="Diagnostics" onClick={() => setPanel('diagnostics')}><Bug size={15} strokeWidth={1.7} /></button>}
          {!collapsed && <button type="button" className={`${utilityButton} mr-1 max-lg:hidden`} title="Help" aria-label="Help" onClick={() => openPanel('help')}><CircleHelp size={15} strokeWidth={1.7} /></button>}
        </div>
      </footer>
    </aside>

    {panel && <DashboardDialog title={panelTitles[panel] ?? panel} onClose={() => setPanel(null)}>
      {panel === 'menu' || panel === 'switcher' ? <div className="grid gap-2">
        <Link className="dash-button justify-start" to="/dashboard" onClick={() => setPanel(null)}><Plus size={15} />Home</Link>
        <Link className="dash-button justify-start" to="/workflows" onClick={() => setPanel(null)}><Workflow size={15} />All workflows</Link>
        <button className="dash-button justify-start" onClick={() => choosePanel('library')}><Library size={15} />Templates</button>
        <button className="dash-button justify-start" onClick={() => choosePanel('settings')}><Settings size={15} />Settings</button>
      </div> : panel === 'library' ? <WorkflowTemplates /> : <>
        <p className="modal-copy">{panel === 'record' ? 'Open a workflow and choose Needs teaching to demonstrate a step in the embedded browser.' : panel === 'integrations' ? 'Discovery uses your configured local Screenpipe and the Ghost discovery pipe. Saved workflows use your configured backend; other app integrations are not configured here.' : panel === 'activity' ? 'Open a workflow to inspect its captured actions and run results. Home shows illustrative activity in preview mode.' : panel === 'help' ? 'Describe a routine on Home, review its steps, then teach Ghost any browser actions it needs. You choose when to test and run it.' : panel === 'diagnostics' ? 'Ghost · Version 0.1.0. Open a workflow’s run log to inspect execution details. Recording and workflow tools run in the desktop app.' : 'Your local Ghost workspace. No account required.'}</p>
        {panel === 'record' && <Link className="dash-button modal-action" to="/workflows" onClick={() => setPanel(null)}>Browse workflows <ChevronRight size={15} /></Link>}
      </>}
    </DashboardDialog>}
  </>
}
