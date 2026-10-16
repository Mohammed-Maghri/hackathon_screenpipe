import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, CircleDot, Home, LayoutGrid, Library, Settings, Unplug } from './ImageIcon'
import { GhostLogo } from './GhostLogo'
import { DashboardDialog } from './DashboardDialog'

const items = [
  { label: 'Home', icon: Home, to: '/dashboard' },
  { label: 'Workflows', icon: LayoutGrid, to: '/workflows' },
  { label: 'Record', icon: CircleDot },
  { label: 'Library', icon: Library },
  { label: 'Integrations', icon: Unplug },
  { label: 'Settings', icon: Settings },
]
export function WorkflowSidebar() {
  const [panel, setPanel] = useState<string | null>(null)
  return <>
    <aside className="dashboard-sidebar editor-sidebar">
      <Link className="sidebar-brand" to="/dashboard" aria-label="Ghost home"><GhostLogo /></Link>
      <nav aria-label="Main navigation">{items.map(({ label, icon: Icon, to }) => to ? <Link key={label} to={to} title={label} aria-label={label} className={`nav-item ${label === 'Workflows' ? 'is-active' : ''}`} aria-current={label === 'Workflows' ? 'page' : undefined}><Icon size={19} strokeWidth={1.6} /><span>{label}</span></Link> : <button key={label} className="nav-item" title={label} aria-label={label} onClick={() => setPanel(label)}><Icon size={19} strokeWidth={1.6} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-message">Turn<br />repetitive work<br />into freedom.<i /></div><button className="profile-button" onClick={() => setPanel('My workspace')}><span className="avatar">G</span><span>My workspace<small>Local preview</small></span><ChevronRight size={16} /></button></div>
    </aside>
    {panel && <DashboardDialog title={panel} onClose={() => setPanel(null)}><p className="modal-copy">{panel === 'Record' ? 'Open a workflow and choose Needs teaching to demonstrate a step in the embedded browser.' : panel === 'Integrations' ? 'This workspace uses sample data. Screenpipe and other apps are not connected yet.' : panel === 'Settings' ? 'Ghost dark · Local sample data · Version 0.1.0. Drafts remain available across pages until you reload the app.' : panel === 'Library' ? 'Browse your workflows to explore the sample routines and open their canvases.' : 'Your local Ghost workspace. No account required.'}</p>{panel === 'Library' && <Link className="dash-button modal-action" to="/workflows" onClick={() => setPanel(null)}>Browse workflows</Link>}</DashboardDialog>}
  </>
}
