export interface ActivityRange { startTime: string; endTime: string }
export interface ActivityBucket extends ActivityRange { minutes: number; apps: { name: string; minutes: number }[] }
export type ActivityTimelineResult = { ok: true; buckets: ActivityBucket[]; dataStatus: string } | { ok: false; code: 'disconnected' | 'authentication' | 'unsupported' | 'invalid' | 'failed'; error: string }
export function localDayRange(date: Date): ActivityRange {
  const start = new Date(date); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return { startTime: start.toISOString(), endTime: end.toISOString() }
}
