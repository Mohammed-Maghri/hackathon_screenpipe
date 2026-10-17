import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { RecordStep } from './RecordStep'
import { WorkflowEditor } from './WorkflowEditor'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { cacheBackendWorkflow } from '../data/workflowStore'
import { savedEditorNodes } from '../data/savedEditorNodes'
import { recoverDraft } from '../data/workflowDrafts'
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
    setValue(null)
    if (!window.ghost) { setError('Open Ghost desktop to load this workflow.'); return }
    void window.ghost.getWorkflow(id).then(result => {
      if (!active) return
      if (!result.ok) { setError(result.error); return }
      const workflow = result.workflow
      cacheBackendWorkflow(workflow)
      const recovered = recoverDraft(workflow)
      const nodes = savedEditorNodes(recovered)
      editorSnapshots.set(id, { nodes, title: recovered.name, connections: recovered.edges.map(edge => [edge.sourceNodeId, edge.targetNodeId]) })
      setValue(workflow)
    }).catch(() => { if (active) setError('Unable to load workflow. Please retry.') })
    return () => { active = false }
  }, [id, recording, attempt])
  if (value && recording) return <RecordStep key={`${id}:${value.updatedAt}`} />
  if (value) return <WorkflowEditor key={id} backendWorkflow={value} />
  return <div className="editor-shell absolute inset-0 flex overflow-hidden bg-panel font-sans text-sm leading-6 text-ink"><WorkflowSidebar /><main className="editor-not-found grid h-full min-w-0 flex-1 place-content-center gap-6 bg-canvas p-8 text-center text-ink [&>h1]:text-2xl [&>h1]:font-medium [&>h1]:tracking-tight"><p role={error ? 'alert' : 'status'}>{error || 'Loading saved workflow…'}</p>{error && <button className="dash-button" onClick={() => setAttempt(current => current + 1)}>Retry</button>}</main></div>
}
