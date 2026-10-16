import { useSyncExternalStore } from 'react'
import { sampleWorkflows, type Workflow } from './workflows'

// Keep drafts available when navigating between standalone pages.
let workflows: Workflow[] = sampleWorkflows.map(workflow => ({ ...workflow }))
const listeners = new Set<() => void>()
export function useWorkflows() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => workflows)
}
export function addWorkflowDraft(name: string, description: string, steps: string[] = []) {
  const workflow: Workflow = { id: crypto.randomUUID(), name, description, steps, apps: [], seen: 0, lastRun: 'Never', status: 'Draft', nextRun: '—' }
  workflows = [...workflows, workflow]
  listeners.forEach(listener => listener())
  return workflow
}

export function cacheBackendWorkflow(value: import('../../../shared/discovery').SavedWorkflowDetail) {
  const workflow: Workflow = { persisted: true, id: value.id, name: value.name, description: value.description ?? '', apps: [], seen: 0, lastRun: 'Never', status: 'Draft', nextRun: '—', steps: value.nodes.map(node => node.label) }
  workflows = [...workflows.filter(item => item.id !== value.id), workflow]
  listeners.forEach(listener => listener())
}
