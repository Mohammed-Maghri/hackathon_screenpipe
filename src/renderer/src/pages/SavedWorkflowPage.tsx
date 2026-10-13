import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { RecordStep } from './RecordStep'
import { WorkflowEditor } from './WorkflowEditor'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { cacheBackendWorkflow } from '../data/workflowStore'
import { savedEditorNodes } from '../data/savedEditorNodes'
import { editorSnapshots } from '../data/editorState'
import type { SavedWorkflowDetail } from '../../../shared/discovery'

export function SavedWorkflowPage({ recording = false }: { recording?: boolean }) {
  const { id = '' } = useParams()
  const [value, setValue] = useState<SavedWorkflowDetail | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setError('')
    if (!window.ghost) { setError('Open Ghost desktop to load this workflow.'); return }
    void window.ghost.getWorkflow(id).then(result => {
      if (!active) return
      if (!result.ok) { setError(result.error); return }
      const workflow = result.workflow
      cacheBackendWorkflow(workflow)
      const nodes = savedEditorNodes(workflow)
      editorSnapshots.set(id, { nodes, title: workflow.name })
      setValue(workflow)
    }).catch(() => { if (active) setError('Unable to load workflow. Please retry.') })
    return () => { active = false }
  }, [id, attempt])
  if (value && recording) return <RecordStep key={id} />
  if (value) return <WorkflowEditor key={id} backendWorkflow={value} />
  return <div className="editor-shell"><WorkflowSidebar /><main className="editor-not-found"><p role={error ? 'alert' : 'status'}>{error || 'Loading saved workflow…'}</p>{error && <button className="dash-button" onClick={() => setAttempt(current => current + 1)}>Retry</button>}</main></div>
}
