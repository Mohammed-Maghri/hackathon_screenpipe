import { z } from 'zod'

export const discoveryInputSchema = z.object({
  prompt: z.string().max(10000).refine(value => value.trim().length > 0),
  timeRange: z.enum(['Last 24 hours', 'Last 7 days', 'Last 30 days']),
  requestId: z.string().uuid(),
  selectedRange: z.object({ startTime: z.string().datetime(), endTime: z.string().datetime() }).strict().refine(r => { const duration = Date.parse(r.endTime) - Date.parse(r.startTime); return duration > 0 && duration <= 7 * 86400000 }, 'Invalid selected interval').optional(),
}).strict()
export const evidenceSchema = z.object({
  id: z.string().regex(/^screenpipe:(frame|audio):[0-9]+$/),
  type: z.enum(['frame', 'audio']), sourceId: z.number().int().nonnegative(),
  timestamp: z.string().datetime({ offset: true }),
  application: z.string().max(200), windowName: z.string().max(500),
  url: z.string().url().nullable(),
}).strict().refine(value => value.id === `screenpipe:${value.type}:${value.sourceId}`)
export const screenpipeSaveSchema = discoveryInputSchema.extend({
  output: z.unknown(), evidence: z.array(evidenceSchema).min(1).max(100),
  startTime: z.string().datetime(), endTime: z.string().datetime(),
  truncated: z.boolean(),
}).strict()
export type DiscoveryEvidence = z.infer<typeof evidenceSchema>
// Conservative redaction for captured text, not a claim to detect every secret.
export function redactCapture(text: string): string {
  return text.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[redacted key]')
    .replace(/\b(?:sk-(?:proj-)?|ghp_|github_pat_)[A-Za-z0-9_-]{12,}/g, '[redacted token]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted token]')
    .replace(/\b(?:password|passwd|passcode|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret|authorization|cookie)\s*[:=][^\r\n]*/gi, '[redacted sensitive field]')
    .replace(/https?:\/\/[^\s"<>]+/g, value => safeObservedUrl(value) ?? '[redacted URL]')
}
export function safeObservedUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || /(?:token|secret|password|webhooks?)\b/i.test(url.pathname)) return null
    url.search = ''; url.hash = ''
    return url.href
  } catch { return null }
}
