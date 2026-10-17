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

function AppRoutes() {
  const location = useLocation()
  const background = /^\/settings(?:\/|$)/.test(location.pathname) ? getSettingsBackground((location.state as { backgroundLocation?: unknown } | null)?.backgroundLocation) : undefined
  const workspacePath = background?.pathname ?? location.pathname
  const nativeChrome = window.ghost?.platform === 'darwin' && /^\/(dashboard|workflows)(?:\/|$)/.test(workspacePath)
  return <>
    <div className="h-full" aria-hidden={background ? true : undefined} inert={Boolean(background)}>
      <WorkspaceFrame nativeChrome={nativeChrome}>
        <Routes location={background ?? location}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings/:section?" element={<Settings />} />
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
  return <MotionConfig reducedMotion="user"><HashRouter><AppRoutes /></HashRouter></MotionConfig>
}
