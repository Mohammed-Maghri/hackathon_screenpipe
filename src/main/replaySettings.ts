import type { RecordedEvent } from '../shared/recording'
export interface SavedInput { sequence: number; label: string; value: string }
export function recordingInputs(events: RecordedEvent[]): SavedInput[] {
  return events.filter(e => e.type === 'input' && typeof e.data.value === 'string' && e.data.value !== '[REDACTED]' && !(e.data.target as { redacted?: boolean })?.redacted && typeof e.data.checked !== 'boolean' && !e.data.selectedValues).map(e => ({ sequence: e.sequence, label: (e.data.target as { label?: string; selector?: string }).label || (e.data.target as { selector?: string }).selector || 'Input', value: String(e.data.value) }))
}
export function applyInputs(events: RecordedEvent[], inputs: SavedInput[]) {
  const allowed = new Set(recordingInputs(events).map(i => i.sequence))
  for (const input of inputs) if (!allowed.has(input.sequence) || typeof input.value !== 'string' || input.value.length > 10000) throw new Error('Invalid saved input.')
  const values = new Map(inputs.map(i => [i.sequence, i.value]))
  return events.map(e => values.has(e.sequence) ? { ...e, data: { ...e.data, value: values.get(e.sequence) } } : e)
}
