import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { mkdir, open, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { discoveryInputSchema } from '../shared/screenpipeDiscovery.js'
import type { DiscoveryProgress, GenerateWorkflowRequest, WorkflowDetailResult } from '../shared/discovery.js'
const PIPE = 'ghost-workflow-discovery'
const active = new Set<string>()
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
type Config = { url?: string; key?: string; backend?: string; stateDir?: string; outputDir?: string; pollMs?: number; timeoutMs?: number; notify?: (event: DiscoveryProgress) => void }
function baseURL(value: string, local = false) {
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol) || (local && !['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('Use a local Screenpipe URL without embedded credentials. The Pipe final file lives on this computer.')
  return url
}
async function json(response: Response) {
  const reader = response.body?.getReader(); if (!reader) throw new Error('Empty service response.')
  const chunks: Uint8Array[] = []; let size = 0
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 1048576) throw new Error('Service response too large.'); chunks.push(value) }
    return obj(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  } finally { await reader.cancel().catch(() => {}) }
}
export async function discoverScreenpipeAgentWorkflow(raw: GenerateWorkflowRequest, config: Config = {}): Promise<WorkflowDetailResult> {
  const parsed = discoveryInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Enter a valid request and select a supported time range.' }
  const input = parsed.data
  if (active.has(input.requestId)) return { ok: false, error: 'This discovery is already running.' }
  active.add(input.requestId)
  try {
    const key = config.key ?? process.env.SCREENPIPE_LOCAL_API_KEY
    if (!key?.trim()) throw new Error('Set SCREENPIPE_LOCAL_API_KEY in the root .env and restart Ghost.')
    const base = baseURL(config.url ?? process.env.SCREENPIPE_LOCAL_API_URL ?? 'http://localhost:3030', true)
    const backend = baseURL(config.backend ?? process.env.GHOST_BACKEND_URL ?? 'http://127.0.0.1:3001')
    const signal = AbortSignal.timeout(config.timeoutMs ?? 360000)
    const request = async (path: string, body?: unknown, local = true) => {
      let response: Response
      try { response = await fetch(new URL(path, local ? base : backend), { signal: AbortSignal.any([signal, AbortSignal.timeout(!local && path.endsWith('/format') ? 75000 : 15000)]), redirect: 'error',
        headers: { 'Content-Type': 'application/json', ...(local ? { Authorization: `Bearer ${key}`, 'X-Screenpipe-Client': 'api', 'X-Screenpipe-Agent': 'ghost' } : {}) },
        ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
      }) } catch { throw new Error(`${local ? 'Screenpipe' : 'Ghost backend'} is disconnected or timed out. Retry the same request; Ghost will not automatically start a duplicate Pipe run.`) }
      if (response.status === 404 && !local) return null
      if (!response.ok) {
        if (!local) {
          const failure = await json(response).catch(() => ({}))
          const code = obj(obj(failure).error).code
          const messages: Record<string, string> = {
            AI_NOT_CONFIGURED: 'Configure the backend OpenAI key to format the Screenpipe answer.',
            AI_UNAVAILABLE: 'Ghost AI formatting timed out. Retry to reuse the existing Screenpipe answer.',
            AI_REJECTED: 'Ghost AI could not format the answer. Check the backend AI model, key and quota, then retry.',
            INVALID_AI_OUTPUT: 'Ghost AI returned an invalid workflow. Retry formatting; the Screenpipe answer is preserved.',
            NO_WORKFLOW: 'Screenpipe found insufficient supported activity. Choose a relevant time range or clarify the task.',
          }
          if (typeof code === 'string' && messages[code]) throw new Error(messages[code])
        }
        await response.body?.cancel()
        if ([401,403].includes(response.status)) throw new Error('Screenpipe or backend rejected authentication. Check the configured token and permissions.')
        if (local && response.status === 409) throw new Error('Screenpipe agent service is unavailable (HTTP 409). Reopen Screenpipe and configure its AI preset, then retry.')
        if (local && response.status === 404) throw new Error('Install the Ghost discovery Pipe using npm run screenpipe:install. The required Pipe/API is missing.')
        throw new Error(`${local ? 'Screenpipe AI service' : 'Workflow validation/save'} failed (HTTP ${response.status}). No successful workflow generation was confirmed.`)
      }
      return json(response)
    }
    const hash = createHash('sha256').update(JSON.stringify({ prompt: input.prompt, timeRange: input.timeRange, ...(input.selectedRange ? { selectedRange: input.selectedRange } : {}) })).digest('hex')
    const existing = await request(`/api/workflows/${input.requestId}`, undefined, false)
    if (existing) {
      if (!Array.isArray(existing.nodes) || !existing.nodes.length || existing.nodes.some(n => obj(obj(n).config).discoveryRequestHash !== hash)) throw new Error('Request ID belongs to another workflow.')
      return { ok: true, workflow: existing as unknown as Extract<WorkflowDetailResult,{ok:true}>['workflow'] }
    }
    const prepared = await request('/api/workflow-discovery/prepare', { prompt: input.prompt, timeRange: input.timeRange }, false)
    const messages = prepared?.messages
    if (!Array.isArray(messages) || obj(messages[1]).content !== input.prompt || typeof obj(messages[0]).content !== 'string') throw new Error('Invalid Ghost discovery instructions.')
    const stateDir = config.stateDir ?? join(homedir(), '.ghost', 'screenpipe-discovery')
    await mkdir(stateDir, { recursive: true, mode: 0o700 })
    const receipt = join(stateDir, `${input.requestId}.json`)
    let run: Record<string, unknown>
    try { run = obj(JSON.parse(await readFile(receipt, 'utf8'))) } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Cannot read discovery receipt. Inspect it before starting another run.'); run = {} }
    if (run.hash && run.hash !== hash) throw new Error('Request ID belongs to another prompt.')
    if (!run.executionId) {
      if (run.status) throw new Error('The previous run-start outcome is unknown. Check Screenpipe before submitting a new request; Ghost will not repeat it automatically.')
      const pipe = await request(`/pipes/${PIPE}`)
      if (pipe?.error) throw new Error('Ghost discovery Pipe is not installed. Run npm run screenpipe:install.')
      const endTime = input.selectedRange?.endTime ?? new Date().toISOString(), startTime = input.selectedRange?.startTime ?? new Date(Date.parse(endTime) - { 'Last 24 hours': 1, 'Last 7 days': 7, 'Last 30 days': 30 }[input.timeRange] * 86400000).toISOString()
      await writeFile(receipt, JSON.stringify({ hash, status: 'starting' }), { flag: 'wx', mode: 0o600 })
      config.notify?.({ requestId: input.requestId, phase: 'activity' })
      const started = await request(`/pipes/${PIPE}/run`, { run_context: { requestId: input.requestId, prompt: input.prompt, timeRange: input.timeRange, startTime, endTime, systemPrompt: obj(messages[0]).content } })
      if (!started?.success || !Number.isSafeInteger(started.execution_id) || Number(started.execution_id) <= 0) throw new Error('Screenpipe did not confirm a trackable run. Inspect Screenpipe before starting another request.')
      run = { hash, status: 'running', executionId: started.execution_id }
      await writeFile(receipt, JSON.stringify(run), { mode: 0o600 })
    }
    const executionId = Number(run.executionId)
    if (!Number.isSafeInteger(executionId) || executionId <= 0) throw new Error('Invalid saved execution ID.')
    config.notify?.({ requestId: input.requestId, phase: 'ai' })
    while (true) {
      // Exact-ID lookup using bounded metadata API. Never download stdout/session/tool logs.
      const result = await request(`/pipes/${PIPE}/executions?include_output=false&limit=1&before_id=${executionId + 1}`)
      const row = Array.isArray(result?.data) ? obj(result.data[0]) : {}
      if (row.id !== executionId || row.pipe_name !== PIPE) throw new Error('Screenpipe could not find this exact run. No other run result will be used.')
      if (row.status === 'completed') break
      if (!['running', 'queued', 'pending'].includes(String(row.status))) throw new Error(`Screenpipe discovery did not complete successfully. Check the run in Screenpipe; no workflow was saved.`)
      await delay(config.pollMs ?? 1500, undefined, { signal })
    }
    const output = join(config.outputDir ?? process.env.SCREENPIPE_DISCOVERY_OUTPUT_DIR ?? join(homedir(), '.screenpipe', 'pipes', PIPE, 'output'), `${input.requestId}.json`)
    const file = await open(output, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => { throw new Error('Screenpipe finished but did not write the final workflow JSON. Check the Pipe instructions and output directory.') })
    let responseText: string
    try { const stat = await file.stat(); if (!stat.isFile() || stat.size > 131072) throw new Error('Invalid or oversized final response.'); responseText = await file.readFile('utf8') } finally { await file.close() }
    if (!responseText.trim()) throw new Error('Screenpipe returned an empty answer. No workflow was saved.')
    let envelope: Record<string, unknown> = {}
    try { envelope = obj(JSON.parse(responseText)) } catch { /* The backend formatter accepts prose too. */ }
    if (envelope.requestId && envelope.requestId !== input.requestId) throw new Error('Screenpipe returned an answer for another request. No workflow was saved.')
    if (Array.isArray(envelope.steps) && !envelope.steps.length) throw new Error('Screenpipe could not identify a supported workflow in the selected history. Choose a range containing relevant activity.')
    config.notify?.({ requestId: input.requestId, phase: 'saving' })
    const saved = await request('/api/workflow-discovery/format', { ...input, pipeId: PIPE, executionId, responseText }, false)
    if (saved?.id !== input.requestId || !Array.isArray(saved.nodes) || !Array.isArray(saved.edges)) throw new Error('Backend did not confirm the saved workflow.')
    return { ok: true, workflow: saved as unknown as Extract<WorkflowDetailResult,{ok:true}>['workflow'] }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return { ok: false, error: error instanceof SyntaxError ? 'Screenpipe returned invalid JSON. No workflow was saved.' : message || 'Screenpipe discovery failed. Retry the same request to recover its run.' }
  } finally { active.delete(input.requestId) }
}
