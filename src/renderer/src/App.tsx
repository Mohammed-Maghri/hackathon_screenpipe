import { HashRouter, Route, Routes, useParams } from 'react-router'
import { MotionConfig } from 'motion/react'
import { Welcome } from './pages/Welcome'
import { useWorkflows } from './data/workflowStore'
import { SavedWorkflowPage } from './pages/SavedWorkflowPage'
import { WorkflowEditor } from './pages/WorkflowEditor'
import { RecordStep } from './pages/RecordStep'
import { Workflows } from './pages/Workflows'
import { Dashboard } from './pages/Dashboard'

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

export function App() {
  return <MotionConfig reducedMotion="user"><HashRouter><Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/workflows" element={<Workflows />} />
    <Route path="/workflows/:id/record/:nodeId" element={<RecordingPage />} />
    <Route path="/workflows/:id" element={<WorkflowPage />} />
    <Route path="*" element={<Welcome />} />
  </Routes></HashRouter></MotionConfig>
}
