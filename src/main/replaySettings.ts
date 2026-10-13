import type { RecordedEvent } from '../shared/recording'
export interface SavedInput { sequence: number; label: string; value: string; secret?: boolean; saved?: boolean; encryptedValue?: unknown }
export function recordingInputs(events: RecordedEvent[]): SavedInput[] {
  return events.filter(e => e.type === 'input' && typeof e.data.value === 'string' && (e.data.encryptedValue || (e.data.target as { credential?: boolean })?.credential || (e.data.value !== '[REDACTED]' && !(e.data.target as { redacted?: boolean })?.redacted)) && typeof e.data.checked !== 'boolean' && !e.data.selectedValues).map(e => {
    const secret = !!e.data.encryptedValue || !!(e.data.target as { credential?: boolean })?.credential
    return { sequence: e.sequence, label: (e.data.target as { label?: string; selector?: string }).label || (e.data.target as { selector?: string }).selector || 'Input', value: secret ? '' : String(e.data.value), ...(secret ? { secret: true, saved: !!e.data.encryptedValue } : {}) }
  })
}
export function applyInputs(events: RecordedEvent[], inputs: SavedInput[]) {
  const allowed = new Map(recordingInputs(events).map(i => [i.sequence, i]))
  for (const input of inputs) {
    const field = allowed.get(input.sequence)
    if (!field || typeof input.value !== 'string' || input.value.length > 10000) throw new Error('Invalid saved input.')
    if (field.secret && input.value) throw new Error('Secret input must be encrypted before persistence.')
    if (!field.secret && input.encryptedValue) throw new Error('Unexpected encrypted input.')
  }
  const values = new Map(inputs.map(i => [i.sequence, i]))
  // Browser change events can repeat the same value after a coalesced scroll.
  // An edited override must cover that duplicate capture, not be overwritten by it.
  const passive = new Set(['pointerdown', 'pointerup', 'scroll', 'page-ready', 'action-outcome', 'focus-outcome'])
  const identity = (event: RecordedEvent) => {
    const target = event.data.target as { testId?: string; stableId?: string; label?: string; role?: string; tag?: string; inputType?: string; name?: string; placeholder?: string; selector?: string }
    const semantic = target?.testId || target?.stableId || target?.label || target?.name || target?.placeholder || target?.selector
    return JSON.stringify([event.url, event.data.framePath ?? [], target?.tag, target?.role, target?.inputType, semantic])
  }
  for (const input of inputs) {
    const index = events.findIndex(event => event.sequence === input.sequence)
    const source = events[index]
    if (!source || allowed.get(input.sequence)?.secret || input.value === source.data.value) continue
    for (const direction of [-1, 1]) for (let i = index + direction; i >= 0 && i < events.length; i += direction) {
      const candidate = events[i]
      if (passive.has(candidate.type)) continue
      if (candidate.type !== 'input' || identity(source) !== identity(candidate) || candidate.data.value !== source.data.value) break
      const explicit = inputs.find(value => value.sequence === candidate.sequence)
      if (explicit && explicit.value !== candidate.data.value && explicit.value !== input.value) throw new Error('Conflicting replacements for a repeated field value.')
      values.set(candidate.sequence, { ...input, sequence: candidate.sequence })
    }
  }
  return events.map(e => {
    const input = values.get(e.sequence)
    if (!input) return e
    if (allowed.get(e.sequence)?.secret) return input.encryptedValue ? { ...e, data: { ...e.data, value: '[ENCRYPTED]', encryptedValue: input.encryptedValue } } : e
    return { ...e, data: { ...e.data, value: input.value } }
  })
}
