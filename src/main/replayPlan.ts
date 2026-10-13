import { recordingInputs } from './replaySettings'
import type { RecordedEvent, ReplayPreview, TargetDescriptor } from '../shared/recording'

export function buildReplayPlan(events: RecordedEvent[]): { steps: RecordedEvent[]; preview: ReplayPreview } {
  const steps: RecordedEvent[] = [], blockers = new Set<string>()
  const supported = new Set(['navigation', 'frame-navigation', 'click', 'input', 'keydown', 'scroll', 'submit'])
  const ignored = new Set(['pointerdown', 'pointerup', 'page-ready', 'action-outcome'])
  const stableId = (id?: string) => !!id && !/(:|\d{4,}|[a-f\d]{8}-|^(react|radix|headlessui|mui)[-_])/i.test(id)
  const target = (event: RecordedEvent) => event.data.target as TargetDescriptor | undefined
  const identity = (t?: TargetDescriptor) => t?.testId || t?.stableId || (t?.accessibleName ? JSON.stringify([t.role, t.accessibleName, t.context]) : t?.selector)
  const same = (a: RecordedEvent, b: RecordedEvent) => a.url === b.url && JSON.stringify(a.data.framePath ?? []) === JSON.stringify(b.data.framePath ?? []) && identity(target(a)) === identity(target(b))
  const outcomes = new Map(events.filter(e => e.type === 'action-outcome').map(e => [e.data.actionId, e.data.evidence]))
  for (const original of events) {
    const event = { ...original, data: { ...original.data } }
    if (event.type === 'page-ready' && Number(event.data.iframeCount) > 0 && !['guarded-main-frame-v1', 'frame-aware-v1'].includes(String(event.data.framePolicy))) blockers.add('This older recording contains frames without interaction guards. Record the main-page task again with the updated recorder.')
    if (!supported.has(event.type)) {
      if (!ignored.has(event.type)) blockers.add(event.type === 'unsupported' && typeof event.data.reason === 'string' ? event.data.reason : `Unsupported action: ${event.type}. ${String(event.data.reason ?? 'Record a task without this action.')}`)
      continue
    }
    const t = target(event)
    const pointer = event.data.pointer as { button?: number; modifiers?: Record<string, boolean> } | undefined
    if (event.type === 'click' && ((pointer?.button !== undefined && pointer.button !== 0) || Object.values(pointer?.modifiers ?? {}).some(Boolean))) blockers.add('Modified or non-left clicks are not supported by verified replay.')
    if (event.data.authenticationRequired) blockers.add('The recording includes an authentication URL. Authenticate manually and record a new task.')
    if (t?.redacted || event.data.value === '[REDACTED]') blockers.add('Manual authentication required. Pause capture, authenticate, then record a new task without sensitive fields.')
    if (event.data.truncated) blockers.add('An input was truncated; it cannot be reproduced accurately.')
    if (!['navigation', 'frame-navigation', 'submit'].includes(event.type) && (!t || !(stableId(t.id) || t.testId || t.accessibleName || t.label || t.text || t.placeholder || t.name || (event.type === 'scroll' && t.tag === 'html')))) blockers.add(`Event ${event.sequence} has no reliable target identity. Record again with semantic target information.`)
    if (outcomes.has(event.data.actionId)) event.data.evidence = outcomes.get(event.data.actionId)
    if (event.type === 'submit') {
      const cause = steps.find(e => e.data.actionId && e.data.actionId === event.data.causedBy)
      if (cause) { cause.data.submitsForm = true; continue }
      blockers.add(`Form submission ${event.sequence} has no captured triggering action. Record again.`)
    }
    const previous = steps.at(-1)
    // Both input and change report the same state. Never merge across an intervening action.
    if (previous?.type === 'input' && event.type === 'input' && same(previous, event)) { steps[steps.length - 1] = event; continue }
    if (event.type === 'click' && t?.tag === 'select' && previous?.type === 'input' && same(previous, event) && Array.isArray(previous.data.selectedValues)) continue
    // Set controls to their recorded state rather than toggling twice (click + input).
    if (event.type === 'input' && (previous?.type === 'click' || (previous?.type === 'keydown' && target(previous)?.tag === 'select')) && same(previous, event) && (typeof event.data.checked === 'boolean' || Array.isArray(event.data.selectedValues))) steps.pop()
    const text = String(t?.text || t?.accessibleName || t?.label || '').trim()
    const consent = event.type === 'click' && (/^(accept (all )?cookies|reject (all )?cookies)$/i.test(text) || (!!event.data.target && !!(event.data.target as { cookieConsent?: boolean }).cookieConsent && /^(accept all|reject all|agree and proceed)$/i.test(text)))
    if (consent) event.data.optionalCookieConsent = true
    // Input elements can also be submit/reset buttons; only actual editable controls are focus-only.
    event.data.focusOnly = event.type === 'click' && (t?.role === 'textbox' || ['textarea', 'select'].includes(t?.tag ?? '') || (t?.tag === 'input' && !['button', 'submit', 'reset', 'checkbox', 'radio', 'file'].includes(t.inputType ?? '')))
    // All general clicks/Enter can cause side effects. Approval is per action, per run.
    event.data.requiresApproval = (event.type === 'click' && !consent && !event.data.focusOnly) || (event.type === 'keydown' && event.data.key === 'Enter')
    steps.push(event)
  }
  if (!steps.some(e => e.type !== 'navigation')) blockers.add('There are no replayable interactions in this recording.')
  return { steps, preview: { inputs: recordingInputs(steps), steps: steps.length, startURL: steps.find(e => e.type === 'navigation')?.url ?? steps[0]?.url ?? null, blockers: [...blockers] } }
}
