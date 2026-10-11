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
