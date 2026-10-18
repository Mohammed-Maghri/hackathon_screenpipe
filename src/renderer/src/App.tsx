import {Team} from './pages/Team'
import { Results } from './pages/Results'
import { ArrowUpRight, MessageSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes, useLocation, useParams } from 'react-router'
import { MotionConfig } from 'motion/react'
import { Welcome } from './pages/Welcome'
import { useWorkflows } from './data/workflowStore'
import { SavedWorkflowPage } from './pages/SavedWorkflowPage'
import { WorkflowEditor } from './pages/WorkflowEditor'
import { RecordStep } from './pages/RecordStep'
import { Workflows } from './pages/Workflows'
import { Dashboard } from './pages/Dashboard'
import { getSettingsBackground, Settings } from './pages/Settings'
import { WorkspaceFrame } from './components/WorkspaceFrame'

function RecordingPage() {
  const { id, nodeId } = useParams()
  const local = useWorkflows().find(item => item.id === id)
  if (id && /^[0-9a-f-]{36}$/i.test(id) && (!local || local.persisted)) return <SavedWorkflowPage key={`${id}/${nodeId}`} recording />
  return <RecordStep key={`${id}/${nodeId}`} />
}

function WorkflowPage() {
  const { id } = useParams()
  const local = useWorkflows().find(item => item.id === id)
  return (!local || local.persisted) && id && /^[0-9a-f-]{36}$/i.test(id) ? <SavedWorkflowPage key={id} /> : <WorkflowEditor key={id} />
}

function SlackReportToast() {
  const [notice, setNotice] = useState<{ reused: boolean } | null>(null)
  useEffect(() => window.ghost?.slack.onReportReady(setNotice), [])
  if (!notice) return null
  return <aside role="status" className="fixed right-6 top-[4.75rem] z-[1000] w-[360px] max-w-[calc(100vw-3rem)]">
    <button aria-label="Open Slack" onClick={() => { void window.ghost?.slack.openChannel(); setNotice(null) }} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#111113]/95 p-4 text-left text-white shadow-[0_20px_70px_rgba(0,0,0,.65)] backdrop-blur-xl transition-transform hover:-translate-y-0.5 hover:border-white/20">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#4a154b] text-white"><MessageSquare size={19}/></span>
      <span className="min-w-0 flex-1"><small className="block text-[10px] font-medium tracking-[.16em] text-white/50">GHOST · REPORT READY</small><strong className="mt-1 block text-sm font-medium">{notice.reused ? 'Latest NOVA report' : 'NOVA report sent'}</strong><span className="mt-0.5 block text-xs text-white/60">Open #daily-reports in Slack</span></span>
      <ArrowUpRight size={17} className="shrink-0 text-white/55"/>
    </button>
  </aside>
}

function AppRoutes() {
  const location = useLocation()
  const background = /^\/settings(?:\/|$)/.test(location.pathname) ? getSettingsBackground((location.state as { backgroundLocation?: unknown } | null)?.backgroundLocation) : undefined
  const workspacePath = background?.pathname ?? location.pathname
  const nativeChrome = window.ghost?.platform === 'darwin' && /^\/(dashboard|workflows|results|team)(?:\/|$)/.test(workspacePath)
  return <>
    <div className="h-full" aria-hidden={background ? true : undefined} inert={Boolean(background)}>
      <WorkspaceFrame nativeChrome={nativeChrome}>
        <Routes location={background ?? location}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings/:section?" element={<Settings />} />
          <Route path="/results" element={<Results />} />
          <Route path="/team" element={<Team />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/workflows/:id/record/:nodeId" element={<RecordingPage />} />
          <Route path="/workflows/:id" element={<WorkflowPage />} />
          <Route path="*" element={<Welcome />} />
        </Routes>
      </WorkspaceFrame>
    </div>
    {background && <Routes><Route path="/settings/:section?" element={<Settings />} /></Routes>}
  </>
}

export function App() {
  return <MotionConfig reducedMotion="user"><HashRouter><AppRoutes /><SlackReportToast /></HashRouter></MotionConfig>
}
