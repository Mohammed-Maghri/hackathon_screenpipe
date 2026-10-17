import { z } from 'zod'
import type { ActivityRange, ActivityBucket, ActivityTimelineResult } from '../shared/activityTimeline'
const rangeSchema = z.object({ startTime: z.string().datetime(), endTime: z.string().datetime() }).strict().refine(r => {
  const span = Date.parse(r.endTime) - Date.parse(r.startTime)
  return span > 0 && span <= 25 * 3600000 && Date.parse(r.startTime) <= Date.now()
})
const summarySchema = z.object({
  time_range: z.object({ start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }) }),
  total_active_minutes: z.number().finite().nonnegative(),
  data_status: z.enum(['ok', 'empty_but_recording', 'no_capture_in_range', 'not_recording', 'unknown']),
  apps: z.array(z.object({ name: z.string().max(500), minutes: z.number().finite().nonnegative() })).optional(),
})
class TimelineError extends Error { constructor(public code: Extract<ActivityTimelineResult, { ok: false }>['code'], message: string) { super(message) } }
export function createActivityTimeline(config: { url?: string; key?: string; fetch?: typeof fetch; now?: () => number } = {}) {
  const cache = new Map<string, { at: number; value: Extract<ActivityTimelineResult, { ok: true }> }>()
  const pending = new Map<string, Promise<ActivityTimelineResult>>()
  const now = config.now ?? Date.now
  async function load(raw: ActivityRange): Promise<ActivityTimelineResult> {
    const parsed = rangeSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, code: 'invalid', error: 'Choose a valid calendar day.' }
    const range = parsed.data, id = JSON.stringify(range)
    const cached = cache.get(id)
    if (cached && now() - cached.at < 60000) return cached.value
    if (pending.has(id)) return pending.get(id)!
    const task = (async (): Promise<ActivityTimelineResult> => {
      try {
        const key = config.key ?? process.env.SCREENPIPE_LOCAL_API_KEY
        if (!key?.trim()) throw new TimelineError('authentication', 'Configure the local Screenpipe API key and restart Ghost.')
        const base = new URL(config.url ?? process.env.SCREENPIPE_LOCAL_API_URL ?? 'http://localhost:3030')
        if (!['http:', 'https:'].includes(base.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || base.username || base.password || base.search || base.hash) throw new TimelineError('invalid', 'Screenpipe activity requires a local API address without credentials.')
        const signal = AbortSignal.timeout(60000)
        async function summary(startTime: string, endTime: string) {
          const url = new URL('/activity-summary', base)
          url.search = new URLSearchParams({ start_time: startTime, end_time: endTime, include_apps: 'true', include_windows: 'false', include_key_texts: 'false', include_recording: 'false', include_memories: 'false', include_snippets: 'false', include_guidance: 'false', include_starred: 'false' }).toString()
          let response: Response
          try { response = await (config.fetch ?? fetch)(url, { headers: { Authorization: `Bearer ${key}`, 'X-Screenpipe-Client': 'api', 'X-Screenpipe-Agent': 'ghost' }, signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), redirect: 'error' }) }
          catch { throw new TimelineError('disconnected', 'Screenpipe is disconnected or timed out. Open Screenpipe and try again.') }
          if (!response.ok) { await response.body?.cancel(); throw new TimelineError([401,403].includes(response.status) ? 'authentication' : response.status === 404 ? 'unsupported' : 'failed', [401,403].includes(response.status) ? 'Screenpipe rejected the configured API key or its permissions.' : response.status === 404 ? 'This Screenpipe version does not support activity summaries.' : 'Screenpipe could not load activity. Try again.') }
          const reader = response.body?.getReader(); if (!reader) throw new TimelineError('failed', 'Screenpipe returned an empty response.')
          let bytes = 0; const chunks: Uint8Array[] = []
          try { while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 1048576) throw new TimelineError('failed', 'Screenpipe summary exceeded the response limit.'); chunks.push(value) } }
          finally { await reader.cancel().catch(() => {}) }
          const result = summarySchema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          if (!result.success || Date.parse(result.data.time_range.start) !== Date.parse(startTime) || Date.parse(result.data.time_range.end) !== Date.parse(endTime)) throw new TimelineError('failed', 'Screenpipe returned an invalid or mismatched activity interval.')
          return result.data
        }
        const end = Math.floor(Math.min(Date.parse(range.endTime), now()) / 1000) * 1000, start = Math.ceil(Date.parse(range.startTime) / 1000) * 1000
        if (end <= start) throw new TimelineError('invalid', 'This day has not started yet.')
        const whole = await summary(new Date(start).toISOString(), new Date(end).toISOString())
        const buckets: ActivityBucket[] = []
        // Query authoritative hourly measurements; never derive duration from frames.
        for (let t = start; t < end; t += 3600000) buckets.push({ startTime: new Date(t).toISOString(), endTime: new Date(Math.min(t + 3600000, end)).toISOString(), minutes: 0, apps: [] })
        if (whole.total_active_minutes > 0) {
          let cursor = 0
          let failed = false
          await Promise.all(Array.from({ length: 3 }, async () => { while (!failed && cursor < buckets.length) { const b = buckets[cursor++]; try { const row = await summary(b.startTime, b.endTime); b.minutes = row.total_active_minutes; b.apps = row.apps ?? [] } catch (error) { failed = true; throw error } } }))
        }
        const value = { ok: true as const, buckets, dataStatus: whole.data_status }
        if (cache.size >= 14) cache.delete(cache.keys().next().value!)
        cache.set(id, { at: now(), value }); return value
      } catch (e) { return { ok: false, code: e instanceof TimelineError ? e.code : 'failed', error: e instanceof TimelineError ? e.message : 'Screenpipe returned an unreadable activity summary.' } }
    })()
    pending.set(id, task)
    try { return await task } finally { pending.delete(id) }
  }
  return load
}
