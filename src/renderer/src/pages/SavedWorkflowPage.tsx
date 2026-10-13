import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { RecordStep } from './RecordStep'
import { WorkflowEditor } from './WorkflowEditor'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { cacheBackendWorkflow } from '../data/workflowStore'
import { editorSnapshots, type EditorNode } from '../data/editorState'
import type { AppName } from '../data/workflows'
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
      const knownApps = ['Microsoft', 'Google', 'Slack', 'Notion', 'Excel', 'Gmail', 'Drive', 'Chrome', 'Screenpipe']
      const nodes: EditorNode[] = workflow.nodes.map(node => ({
        id: node.id, title: node.label, kind: node.config.stepType === 'browser' ? 'Browser action' : node.config.stepType === 'application' ? 'Application action' : node.type,
        description: typeof node.config.description === 'string' ? node.config.description : '',
        app: knownApps.includes(String(node.config.application)) ? node.config.application as AppName : undefined,
        status: node.config.status === 'needs_recording' ? 'Needs teaching' : 'Needs configuration',
        instructions: Array.isArray(node.config.instructions) ? node.config.instructions.filter((item): item is string => typeof item === 'string') : [],
        startUrl: typeof node.config.startUrl === 'string' ? node.config.startUrl : null,
        x: node.positionX, y: node.positionY,
      }))
      editorSnapshots.set(id, { nodes, title: workflow.name })
      setValue(workflow)
    }).catch(() => { if (active) setError('Unable to load workflow. Please retry.') })
    return () => { active = false }
  }, [id, attempt])
  if (value && recording) return <RecordStep key={id} />
  if (value) return <WorkflowEditor key={id} backendWorkflow={value} />
  return <div className="editor-shell"><WorkflowSidebar /><main className="editor-not-found"><p role={error ? 'alert' : 'status'}>{error || 'Loading saved workflow…'}</p>{error && <button className="dash-button" onClick={() => setAttempt(current => current + 1)}>Retry</button>}</main></div>
}
