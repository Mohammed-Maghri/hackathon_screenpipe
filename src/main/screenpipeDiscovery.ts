import { createHash } from 'node:crypto'
import { discoveryInputSchema, evidenceSchema, redactCapture, safeObservedUrl, type DiscoveryEvidence } from '../shared/screenpipeDiscovery.js'
import type { DiscoveryProgress, GenerateWorkflowRequest, WorkflowDetailResult } from '../shared/discovery.js'

type Observation = DiscoveryEvidence & { text: string }
type Config = { url?: string; key?: string; preset?: string; backend?: string }
class DiscoveryError extends Error {}
const active = new Set<string>()
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
async function boundedJSON(response: Response, limit = 1048576): Promise<unknown> {
  const reader = response.body?.getReader()
  if (!reader) throw new DiscoveryError('The discovery service returned an empty response.')
  let size = 0; const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      size += value.byteLength
      if (size > limit) throw new DiscoveryError('Discovery response exceeded the supported size. Use a shorter activity range.')
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch (error) {
    if (error instanceof DiscoveryError) throw error
    throw new DiscoveryError('The discovery service returned invalid or incomplete JSON.')
  } finally { await reader.cancel().catch(() => {}) }
}
function endpoint(value: string, screenpipe = false) {
  try {
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol) || (screenpipe && url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error()
    return url
  } catch { throw new DiscoveryError('Invalid discovery service URL. Use localhost HTTP or an HTTPS Screenpipe endpoint without embedded credentials.') }
}
export function normalizeObservation(row: unknown, start: string, end: string): Observation | null {
  const value = object(row), content = object(value.content)
  const field = (key: string) => value[`content.${key}`] ?? content[key]
  const kind = String(value.type ?? '').toLowerCase()
  if (!['parsed', 'accessibility', 'ocr', 'audio'].includes(kind)) return null
  const type = kind === 'audio' ? 'audio' : 'frame'
  const rawId = type === 'audio' ? field('chunk_id') ?? field('id') : field('frame_id')
  if ((typeof rawId !== 'number' && typeof rawId !== 'string') || rawId === '') return null
  const sourceId = Number(rawId)
  const timestamp = field('timestamp')
  if (!Number.isSafeInteger(sourceId) || sourceId < 0 || typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp)) || Date.parse(timestamp) < Date.parse(start) || Date.parse(timestamp) > Date.parse(end)) return null
  const raw = field('text') ?? field('transcription')
  if (typeof raw !== 'string' || !raw.trim()) return null
  const meta = evidenceSchema.safeParse({ id: `screenpipe:${type}:${sourceId}`, type, sourceId, timestamp,
    application: redactCapture(String(field('app_name') ?? (type === 'audio' ? 'Conversation' : 'Unknown application'))).slice(0, 200),
    windowName: redactCapture(String(field('window_name') ?? '')).slice(0, 500), url: safeObservedUrl(field('browser_url')) })
  return meta.success ? { ...meta.data, text: redactCapture(raw).slice(0, 1800) } : null
}
export function discoverySearchTerms(prompt: string) {
  const stop = new Set('this that with from have want need workflow workflows automate automation find show please about using used daily process tasks task make generate report reports recorded activity things user input screenpipe ghost last hours days'.split(' '))
  const words = prompt.replace(/https?:\/\/\S+/g, '').toLowerCase().match(/[\p{L}\p{N}_-]{4,}/gu) ?? []
  return [...new Set(words.filter(word => !stop.has(word)))].slice(0, 3)
}
export async function discoverScreenpipeWorkflow(raw: GenerateWorkflowRequest, notify: (event: DiscoveryProgress) => void = () => {}, config: Config = {}): Promise<WorkflowDetailResult> {
  const parsed = discoveryInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Enter a request of up to 10,000 characters and choose a supported activity range.' }
  const input = parsed.data
  if (active.has(input.requestId)) return { ok: false, error: 'This request is already generating. Wait before retrying.' }
  active.add(input.requestId)
  const progress = (phase: DiscoveryProgress['phase']) => notify({ requestId: input.requestId, phase })
  const signal = AbortSignal.timeout(150000)
  try {
    const base = endpoint(config.url ?? process.env.SCREENPIPE_LOCAL_API_URL ?? 'http://localhost:3030', true)
    const backend = endpoint(config.backend ?? process.env.GHOST_BACKEND_URL ?? 'http://127.0.0.1:3001')
    const key = config.key ?? process.env.SCREENPIPE_LOCAL_API_KEY
    if (!key?.trim()) throw new DiscoveryError('Screenpipe is not configured. Set SCREENPIPE_LOCAL_API_KEY in the root .env, then restart Ghost. Obtain it with: bun x screenpipe@latest auth token')
    const send = async (url: URL, init: RequestInit, timeout: number) => {
      try { return await fetch(url, { ...init, signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]), redirect: 'error' }) }
      catch { throw new DiscoveryError(url.origin === base.origin ? 'Unable to reach Screenpipe or its AI request timed out. Open Screenpipe and check its connection/AI settings.' : 'Unable to reach the Ghost backend. Start the backend and retry the same request to recover a saved result.') }
    }
    const backendRequest = (path: string, body?: unknown) => send(new URL(path, backend), { ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }), headers: { 'Content-Type': 'application/json' } }, 15000)
    // Recover an already persisted result before reading activity or spending AI tokens.
    const existing = await backendRequest(`/api/workflows/${input.requestId}`)
    if (existing.ok) {
      const saved = object(await boundedJSON(existing))
      const hash = createHash('sha256').update(JSON.stringify({ prompt: input.prompt, timeRange: input.timeRange })).digest('hex')
      if (!Array.isArray(saved.nodes) || !saved.nodes.length || saved.nodes.some(node => object(object(node).config).discoveryRequestHash !== hash)) throw new DiscoveryError('This request ID belongs to another workflow. Submit a new request.')
      return { ok: true, workflow: saved as unknown as Extract<WorkflowDetailResult, { ok: true }>['workflow'] }
    }
    if (existing.status !== 404) throw new DiscoveryError('The backend could not check saved workflows. Check its database connection before retrying.')
    const prepared = await backendRequest('/api/workflow-discovery/prepare', { prompt: input.prompt, timeRange: input.timeRange })
    if (!prepared.ok) throw new DiscoveryError('The backend could not prepare Ghost’s discovery instructions.')
    const preparation = object(await boundedJSON(prepared))
    const messages = preparation.messages
    if (!Array.isArray(messages) || messages.length !== 2 || object(messages[0]).role !== 'system' || typeof object(messages[0]).content !== 'string' || object(messages[1]).role !== 'user' || object(messages[1]).content !== input.prompt) throw new DiscoveryError('The backend returned invalid discovery instructions.')
    const headers = { Authorization: `Bearer ${key}`, 'X-Screenpipe-Client': 'api', 'X-Screenpipe-Agent': 'ghost', 'Content-Type': 'application/json' }
    const screenRequest = async (path: string, body?: unknown, optional = false) => {
      const response = await send(new URL(path, base), { headers, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) }, body ? 90000 : 12000)
      if (optional && [400, 404].includes(response.status)) return null
      if ([401, 403].includes(response.status)) throw new DiscoveryError('Screenpipe rejected access. Check the local API token and its permissions; for AI requests also check the configured provider credentials.')
      if (response.status === 404) throw new DiscoveryError('This Screenpipe version does not provide the required discovery/chat endpoint. Update Screenpipe and configure a local AI preset.')
      if (response.status === 409) throw new DiscoveryError('Screenpipe is in history-only or unavailable mode. Open Screenpipe and retry.')
      if (!response.ok) throw new DiscoveryError(body ? 'Screenpipe AI could not complete discovery. Check its AI preset, provider URL, credentials and quota.' : 'Screenpipe could not read the selected activity. Check recording and storage health.')
      return boundedJSON(response)
    }
    progress('activity')
    const endTime = new Date().toISOString()
    const days = { 'Last 24 hours': 1, 'Last 7 days': 7, 'Last 30 days': 30 }[input.timeRange]
    const startTime = new Date(Date.parse(endTime) - days * 86400000).toISOString()
    const bounds = { start_time: startTime, end_time: endTime }
    const summary = object(await screenRequest('/activity-summary?' + new URLSearchParams({ ...bounds, include_key_texts: 'false', max_snippets: '3', max_snippet_chars: '120' })))
    if (['no_capture_in_range', 'empty_but_recording', 'not_recording'].includes(String(summary.data_status))) throw new DiscoveryError(`Screenpipe has no usable captured activity in ${input.timeRange.toLowerCase()} (${summary.data_status}). Enable recording or select a time range with saved activity.`)
    if (summary.data_status !== 'ok') throw new DiscoveryError('Screenpipe could not confirm available activity. Check its recording/storage status and retry.')
    const observations = new Map<string, Observation>()
    let truncated = true // Query-term retrieval is a sample, even when each page fits.
    async function search(type: string, q?: string, optional = false) {
      for (let page = 0; page < 2 && observations.size < 100; page++) {
        const params = new URLSearchParams({ ...bounds, content_type: type, limit: '20', offset: String(page * 20), max_content_length: '1800', fields: 'type,content.timestamp,content.app_name,content.window_name,content.browser_url,content.text,content.transcription,content.frame_id,content.chunk_id,content.id', ...(q ? { q } : {}) })
        const result = await screenRequest('/search?' + params, undefined, optional)
        if (result === null) return
        const data = object(result).data
        if (!Array.isArray(data)) throw new DiscoveryError('Screenpipe returned an unsupported activity response.')
        for (const row of data) { const record = normalizeObservation(row, startTime, endTime); if (record && !observations.has(record.id) && observations.size < 100) observations.set(record.id, record) }
        if (data.length < 20) break
        if (page === 1) truncated = true
      }
    }
    // Query terms help retrieval; the unmodified request is sent separately to AI.
    const terms = discoverySearchTerms(input.prompt)
    for (const term of terms) await search('all', term)
    await search('parsed', undefined, true)
    if (observations.size < 20) await search('accessibility', undefined, true)
    if (!observations.size) await search('all')
    if (!observations.size) throw new DiscoveryError('No usable Screenpipe evidence was returned for this request and time range. No workflow was invented or saved.')
    const records = [...observations.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    // This is a bounded sample, never a claim of exhaustive discovery.
    truncated ||= observations.size >= 100 || Number(summary.total_frames ?? object(summary.summary).total_frames ?? 0) > records.length
    progress('ai')
    const completion = object(await screenRequest('/v1/local/chat/completions', {
      model: config.preset ?? process.env.SCREENPIPE_AI_PRESET ?? 'default', stream: false,
      messages: [messages[0], { role: 'user', content: JSON.stringify({ kind: 'untrusted_screenpipe_evidence', startTime, endTime, truncated, records }) }, messages[1]],
      response_format: { type: 'json_object' },
    }))
    const choices = completion.choices
    const choice = Array.isArray(choices) ? object(choices[0]) : {}
    const message = object(choice.message)
    if (choice.finish_reason !== 'stop' || typeof message.content !== 'string' || message.tool_calls || message.refusal) throw new DiscoveryError('Screenpipe AI returned an incomplete, refused or unsupported response. No workflow was saved.')
    let output: unknown
    try { output = JSON.parse(message.content) } catch { throw new DiscoveryError('Screenpipe AI did not return the required workflow JSON. Check its AI preset supports JSON output.') }
    progress('saving')
    const saved = await backendRequest('/api/workflow-discovery/screenpipe', { ...input, output, evidence: records.map(({ text: _text, ...metadata }) => metadata), startTime, endTime, truncated })
    const result = object(await boundedJSON(saved))
    if (!saved.ok) {
      const code = object(result.error).code
      if (code === 'SCREENPIPE_INSUFFICIENT_EVIDENCE') throw new DiscoveryError('Screenpipe could not identify this workflow from the selected evidence. Try a more specific request or time range.')
      throw new DiscoveryError('The backend rejected the discovered workflow or could not save it. Evidence references, URLs and node contracts must be valid. Retry the same request to recover a saved result.')
    }
    if (result.id !== input.requestId || !Array.isArray(result.nodes) || !Array.isArray(result.edges)) throw new DiscoveryError('The backend returned an invalid saved workflow.')
    return { ok: true, workflow: result as unknown as Extract<WorkflowDetailResult, { ok: true }>['workflow'] }
  } catch (error) { return { ok: false, error: error instanceof DiscoveryError ? error.message : 'Screenpipe discovery failed. No successful workflow generation was confirmed.' } }
  finally { active.delete(input.requestId) }
}
