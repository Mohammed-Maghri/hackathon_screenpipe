import { workflowClient, preparedDiscovery } from "./workflowClient";
import type { SavedWorkflowDetail, WorkflowCreate, WorkflowDetailResult, WorkflowUpdate } from '../../../shared/discovery'
import type { Workflow } from './workflows'

export function templateDraft(template: Workflow): WorkflowCreate {
  const steps = ['Start workflow', ...template.steps]
  const ids = steps.map(() => crypto.randomUUID())
  return {
    name: template.name, description: template.description, status: 'DRAFT',
    nodes: steps.map((step, index) => ({
      id: ids[index], label: step, type: index === 0 ? 'TRIGGER' : 'ACTION',
      positionX: index === 0 ? 240 : 200,
      positionY: 50 + index * 230,
      config: { stepType: index === 0 ? 'trigger' : 'browser', order: index, description: index === 0 ? 'Start this workflow manually.' : step, status: index === 0 ? 'ready' : 'needs_recording', instructions: index === 0 ? [] : [step], ...(index > 0 && template.apps.length ? { application: template.apps[(index - 1) % template.apps.length] } : {}) },
    })),
    edges: ids.slice(1).map((id, index) => ({ id: crypto.randomUUID(), sourceNodeId: ids[index], targetNodeId: id })),
  }
}

const pendingKey = (id: string) => `ghost.pending-draft.${id}`
// Retain the last edit through a quick navigation, reload, or interrupted request.
export function rememberDraftEdit(id: string, update: WorkflowUpdate) {
  try { localStorage.setItem(pendingKey(id), JSON.stringify(update)); return true } catch { return false }
}
export function pendingDraftEdit(id: string): WorkflowUpdate | null {
  try {
    const value = JSON.parse(localStorage.getItem(pendingKey(id)) ?? 'null') as WorkflowUpdate | null
    if (!value || typeof value.name !== 'string' || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null
    if (!value.nodes.every(node => typeof node.id === 'string' && typeof node.label === 'string' && typeof node.type === 'string' && Number.isFinite(node.positionX) && Number.isFinite(node.positionY) && node.config && typeof node.config === 'object' && !Array.isArray(node.config))) return null
    if (!value.edges.every(edge => typeof edge.id === 'string' && typeof edge.sourceNodeId === 'string' && typeof edge.targetNodeId === 'string')) return null
    return value
  } catch { return null }
}

const saves = new Map<string, { signature: string; result: Promise<WorkflowDetailResult> }>()
// Serialize manual saves, autosaves and the final write when leaving the editor.
export function saveWorkflowDraft(id: string, update: WorkflowUpdate): Promise<WorkflowDetailResult> {
  const signature = JSON.stringify(update)
  const previous = saves.get(id)
  if (previous?.signature === signature) return previous.result
  const result = (previous?.result ?? Promise.resolve()).then(async (): Promise<WorkflowDetailResult> => {
    try {
      if (!window.ghost && !preparedDiscovery) return { ok: false, error: 'Open Ghost desktop to save this draft.' }
      const result = await workflowClient.updateWorkflow(id, update)
      if (result.ok) {
        // A completed older write must not discard newer unsaved edits.
        try { if (JSON.stringify(pendingDraftEdit(id)) === signature) localStorage.removeItem(pendingKey(id)) } catch { /* A retained recovery copy is safe to retry. */ }
      }
      return result
    } catch { return { ok: false, error: 'Unable to save this draft. Check the backend connection and retry.' } }
  })
  saves.set(id, { signature, result })
  void result.finally(() => { if (saves.get(id)?.result === result) saves.delete(id) })
  return result
}

export function recoverDraft(workflow: SavedWorkflowDetail): SavedWorkflowDetail {
  const edit = workflow.status === 'DRAFT' ? pendingDraftEdit(workflow.id) : null
  return edit ? { ...workflow, ...edit } : workflow
}
