import type { DiscoveryPreparation, DiscoveryRequest } from '../shared/discovery'

export async function prepareWorkflowDiscovery(input: DiscoveryRequest): Promise<DiscoveryPreparation> {
  if (!input || typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 10000 || !['Last 24 hours', 'Last 7 days', 'Last 30 days'].includes(input.timeRange)) {
    return { ok: false, error: 'Enter a request of up to 10,000 characters and choose an activity range.' }
  }
  try {
    const base = new URL(process.env.GHOST_BACKEND_URL || 'http://127.0.0.1:3001')
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid backend URL')
    const response = await fetch(new URL('/api/workflow-discovery/prepare', base), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: input.prompt, timeRange: input.timeRange }),
      signal: AbortSignal.timeout(10000), redirect: 'error',
    })
    if (!response.ok) return { ok: false, error: 'The backend could not prepare this request. Check that the backend is running and try again.' }
    const result = await response.json() as { status?: unknown; integrationStatus?: unknown }
    if (result.status !== 'prepared' || result.integrationStatus !== 'not_connected') throw new Error('Unexpected response')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Unable to reach the Ghost backend. Start the backend and try again.' }
  }
}

async function readBackend(path: string): Promise<unknown> {
  const base = new URL(process.env.GHOST_BACKEND_URL || 'http://127.0.0.1:3001')
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid backend URL')
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10000), redirect: 'error' })
  if (!response.ok) throw new Error('Backend request failed')
  return response.json()
}
export async function listSavedWorkflows(offset: number = 0, options: import('../shared/discovery').WorkflowListOptions = {}): Promise<import('../shared/discovery').WorkflowListResult> {
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000) return { ok: false, error: 'Invalid workflow page.' }
  try {
    const params = new URLSearchParams({ limit: String(options.limit ?? 4), offset: String(offset) })
    if (options.status) params.set('status', options.status)
    if (options.search) params.set('search', options.search)
    const result = await readBackend(`/api/workflows?${params}`) as { items: import('../shared/discovery').SavedWorkflow[]; total: number }
    if (!Array.isArray(result.items) || !Number.isInteger(result.total) || !result.items.every(item => typeof item.id === 'string' && typeof item.name === 'string' && item._count && Number.isInteger(item._count.nodes))) throw new Error('Invalid response')
    return { ok: true, items: result.items, total: result.total }
  } catch { return { ok: false, error: 'Unable to load workflows. Check that the Ghost backend is running and retry.' } }
}
export async function getSavedWorkflow(id: string): Promise<import('../shared/discovery').WorkflowDetailResult> {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return { ok: false, error: 'Invalid workflow ID.' }
  try {
    const workflow = await readBackend(`/api/workflows/${id}`) as import('../shared/discovery').SavedWorkflowDetail
    if (workflow.id !== id || typeof workflow.name !== 'string' || !Array.isArray(workflow.nodes) || !Array.isArray(workflow.edges)) throw new Error('Invalid response')
    return { ok: true, workflow }
  } catch { return { ok: false, error: 'Unable to open this workflow. It may have been removed, or the backend is unavailable.' } }
}

export async function mutateWorkflowBackend(path: string, input: unknown, method = 'POST'): Promise<import('../shared/discovery').WorkflowDetailResult> {
  try {
    const base = new URL(process.env.GHOST_BACKEND_URL || 'http://127.0.0.1:3001')
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid backend URL')
    const response = await fetch(new URL(path, base), { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(75000), redirect: 'error' })
    const result = await response.json()
    if (!response.ok) {
      const messages: Record<string, string> = {
        WORKFLOW_CHANGED: 'This workflow changed while defining inputs. Reopen it and try again.',
        INVALID_NODE_CONTRACT: 'An input/output binding is invalid. Review the node definitions.',
        AI_NOT_CONFIGURED: 'Set OPENAI_API_KEY in backend/.env, then restart the backend to generate the board.',
        AI_REJECTED: 'AI generation failed. Check the API key, model and quota, then retry.',
        AI_UNAVAILABLE: 'AI is unavailable or timed out. Retry this request.',
        INVALID_AI_OUTPUT: 'AI returned an invalid workflow. No workflow was saved.',
        DEV_ONLY: 'Mock generation is only available in development.',
        GENERATION_RUNNING: 'This request is already generating. Wait before retrying.',
      }
      return { ok: false, error: messages[result?.error?.code] || 'The backend could not save this workflow. Retry or check the backend.' }
    }
    if (!result || typeof result.id !== 'string' || !Array.isArray(result.nodes) || !Array.isArray(result.edges)) throw new Error('Invalid workflow response')
    return { ok: true, workflow: result }
  } catch { return { ok: false, error: 'Unable to reach the backend. The result may have been saved; retry the same request to recover it.' } }
}
export async function mockWorkflowActivity(input: DiscoveryRequest): Promise<DiscoveryPreparation> {
  try {
    const base = new URL(process.env.GHOST_BACKEND_URL || 'http://127.0.0.1:3001')
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid backend URL')
    const response = await fetch(new URL('/api/workflow-discovery/mock', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(15000), redirect: 'error' })
    if (!response.ok || (await response.json()).source !== 'development_mock') throw new Error('Mock unavailable')
    return { ok: true }
  } catch { return { ok: false, error: 'Unable to load mock activity. Start the backend in development mode and retry.' } }
}

export async function deleteSavedWorkflow(id: string): Promise<DiscoveryPreparation> {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return { ok: false, error: 'Invalid workflow ID.' }
  try {
    const base = new URL(process.env.GHOST_BACKEND_URL || 'http://127.0.0.1:3001')
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid backend URL')
    const response = await fetch(new URL('/api/workflows/' + id, base), { method: 'DELETE', signal: AbortSignal.timeout(10000), redirect: 'error' })
    if (response.status === 204 || response.status === 404) return { ok: true }
    return { ok: false, error: 'Unable to delete this workflow. Please retry.' }
  } catch { return { ok: false, error: 'Unable to confirm deletion. Check the backend connection and refresh or retry.' } }
}
