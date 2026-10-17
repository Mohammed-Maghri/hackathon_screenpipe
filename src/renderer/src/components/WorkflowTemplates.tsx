import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from './ImageIcon'
import { sampleWorkflows, type Workflow } from '../data/workflows'
import { templateDraft } from '../data/workflowDrafts'

export function WorkflowTemplates() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState('')
  const [error, setError] = useState('')
  const busy = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function choose(template: Workflow) {
    if (busy.current) return
    busy.current = true; setCreating(template.id); setError('')
    try {
      if (!window.ghost) throw new Error('Open Ghost desktop to save a template as your own draft.')
      const result = await window.ghost.createWorkflow(templateDraft(template))
      if (!result.ok) throw new Error(result.error)
      if (mounted.current) navigate(`/workflows/${result.workflow.id}`)
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Unable to save this template. Please retry.') }
    finally { busy.current = false; if (mounted.current) setCreating('') }
  }
  return <>
    <p className="modal-copy">Choose a template to create your own saved draft. Your edits save automatically; the original template stays unchanged.</p>
    <div className="template-list" aria-busy={Boolean(creating)}>{sampleWorkflows.slice(0, 3).map(workflow => <button key={workflow.id} className="disabled:cursor-wait disabled:opacity-60" disabled={Boolean(creating)} onClick={() => void choose(workflow)}><span><strong>{workflow.name}</strong><small>{creating === workflow.id ? 'Saving draft…' : `${workflow.steps.length} steps`}</small></span><Plus size={18} /></button>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </>
}
