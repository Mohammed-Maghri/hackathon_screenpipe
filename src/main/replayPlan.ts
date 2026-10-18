import { recordingInputs } from './replaySettings'
import type { RecordedEvent, ReplayPreview, TargetDescriptor } from '../shared/recording'

export function buildReplayPlan(events: RecordedEvent[]): { steps: RecordedEvent[]; preview: ReplayPreview } {
  const steps: RecordedEvent[] = [], notes: string[] = [], blockers = new Set<string>()
  const supported = new Set(['navigation', 'frame-navigation', 'click', 'input', 'keydown', 'scroll', 'submit'])
  const ignored = new Set(['pointerdown', 'pointerup', 'page-ready', 'action-outcome', 'focus-outcome', 'download-done'])
  const stableId = (id?: string) => !!id && !/(:|\d{4,}|[a-f\d]{8}-|^(react|radix|headlessui|mui)[-_])/i.test(id)
  const target = (event: RecordedEvent) => event.data.target as TargetDescriptor | undefined
  const identity = (t?: TargetDescriptor) => t?.testId || t?.stableId || (t?.accessibleName ? JSON.stringify([t.role, t.accessibleName, t.context]) : t?.selector)
  const same = (a: RecordedEvent, b: RecordedEvent) => a.url === b.url && JSON.stringify(a.data.framePath ?? []) === JSON.stringify(b.data.framePath ?? []) && identity(target(a)) === identity(target(b))
  const outcomes = new Map<unknown, unknown[]>()
  for (const event of events.filter(e => e.type === 'action-outcome')) {
    const merged = new Map<string, unknown>()
    for (const item of [...(outcomes.get(event.data.actionId) ?? []), ...(Array.isArray(event.data.evidence) ? event.data.evidence : [])]) {
      const evidence = item as { target?: TargetDescriptor }
      merged.set(JSON.stringify(evidence.target), item)
    }
    outcomes.set(event.data.actionId, [...merged.values()])
  }
  const focusOutcomes = new Map(events.filter(e => e.type === 'focus-outcome').map(e => [e.data.actionId, e.data.target]))
  for (const original of events) {
    const event = { ...original, data: { ...original.data } }
    if (event.type === 'page-ready' && Number(event.data.iframeCount) > 0 && !['guarded-main-frame-v1', 'frame-aware-v1'].includes(String(event.data.framePolicy))) blockers.add('This older recording contains frames without interaction guards. Record the main-page task again with the updated recorder.')
    if (event.type === 'edit-shortcut') {
      const following = events.slice(events.indexOf(original) + 1).find(e => !ignored.has(e.type))
      if (!following || following.type !== 'input' || !same(event, following) || (target(following)?.redacted && !following.data.encryptedValue)) blockers.add('A text-edit shortcut has no captured non-sensitive field result. Re-record the edit.')
      continue
    }
    if (event.type === 'download-start') {
      const cause = steps.find(step => step.data.actionId === event.data.causedBy && !!event.data.causedBy)
      const done = events.find(step => step.type === 'download-done' && step.data.downloadId === event.data.downloadId)
      if (!cause || done?.data.state !== 'completed') blockers.add('A download has no verified completion or triggering action. Record the export again and wait for it to finish.')
      else cause.data.expectedDownloads = [...(cause.data.expectedDownloads as unknown[] ?? []), { filename: event.data.filename, mimeType: event.data.mimeType }]
      continue
    }
    if (event.type === 'contextmenu' && target(event)?.tag === 'select' && !outcomes.has(event.data.actionId)) {
      const following = events.slice(events.indexOf(original) + 1).find(item => !ignored.has(item.type) && item.type !== 'scroll' && !(item.type === 'keydown' && same(event, item) && ['Home', 'End', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(String(item.data.key))))
      if (following?.type === 'input' && same(event, following) && Array.isArray(following.data.selectedValues)) {
        notes.push(`Event ${event.sequence}: dropdown gesture consolidated into its saved selection.`)
        continue
      }
    }
    if (!supported.has(event.type)) {
      if (!ignored.has(event.type)) blockers.add(event.type === 'unsupported' && typeof event.data.reason === 'string' ? event.data.reason : `Unsupported action: ${event.type}. ${String(event.data.reason ?? 'Record a task without this action.')}`)
      continue
    }
    const t = target(event)
    if (event.type === 'keydown' && t?.tag === 'select' && ['Home', 'End', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', ' '].includes(String(event.data.key)) &&
      !Object.values(event.data.modifiers as Record<string, boolean> ?? {}).some(Boolean) &&
      !events.some(item => item.type === 'submit' && item.data.causedBy === event.data.actionId)) {
      const relevant = (item: RecordedEvent) => !ignored.has(item.type) && item.type !== 'scroll' && !(item.type === 'keydown' && same(event, item))
      const following = events.slice(events.indexOf(original) + 1).find(relevant)
      const preceding = [...steps].reverse().find(relevant)
      if ((following?.type === 'input' && same(event, following) && Array.isArray(following.data.selectedValues)) ||
        (['Enter', 'Escape'].includes(String(event.data.key)) && preceding?.type === 'input' && same(event, preceding) && Array.isArray(preceding.data.selectedValues))) continue
    }

    if (focusOutcomes.has(event.data.actionId)) event.data.focusTarget = focusOutcomes.get(event.data.actionId)
    if (event.type === 'keydown' && event.data.key === 'Tab' && !event.data.focusTarget) {
      const following = events.slice(events.indexOf(original) + 1).find(item => !ignored.has(item.type) && item.type !== 'scroll' && !(item.type === 'input' && same(event, item)))
      if (following && ['input', 'click'].includes(following.type) && !same(event, following) && following.url === event.url && JSON.stringify(following.data.framePath ?? []) === JSON.stringify(event.data.framePath ?? [])) event.data.focusTarget = target(following)
    }
    const pointer = event.data.pointer as { button?: number; buttons?: number; modifiers?: Record<string, boolean> } | undefined
    // Chromium can report -1 for control activation without a mouse-button
    // transition (notably native select completion). It is not a right click.
    // Accept legacy recordings too, but never accept a held secondary button.
    const activation = pointer?.button === -1 && (pointer.buttons === undefined || pointer.buttons === 0)
    if (event.type === 'click' && ((pointer?.button !== undefined && pointer.button !== 0 && !activation) || (pointer?.buttons !== undefined && (pointer.buttons & ~1) !== 0) || Object.values(pointer?.modifiers ?? {}).some(Boolean))) blockers.add(`Action ${event.sequence}: ${t?.redacted ? 'sensitive field' : t?.accessibleName || t?.label || t?.text || 'recorded target'} used ${pointer?.button ? 'mouse button ' + pointer.button : 'left click'}${Object.entries(pointer?.modifiers ?? {}).filter(([, pressed]) => pressed).map(([key]) => ' + ' + key).join('')}. Re-record this action using an ordinary left click without modifier keys.`)
    if (event.data.authenticationRequired) blockers.add('The recording includes an authentication URL. Authenticate manually and record a new task.')
    if ((t?.redacted && !t.credential) || (event.type === 'input' && t?.credential && !event.data.encryptedValue) || (event.data.value === '[REDACTED]' && !event.data.encryptedValue)) blockers.add('Manual authentication required. Pause capture, authenticate, then record a new task without sensitive fields.')
    if (event.data.truncated) blockers.add('An input was truncated; it cannot be reproduced accurately.')
    if (!['navigation', 'frame-navigation', 'submit'].includes(event.type) && (!t || !(stableId(t.id) || t.testId || t.accessibleName || t.label || t.text || t.placeholder || t.name || (t.selector && t.tag && !t.id) || (event.type === 'scroll' && t.tag === 'html')))) blockers.add(`Event ${event.sequence} has no saved target information. Inspect this action to identify the missing element.`)
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
    event.data.requiresApproval = !t?.loginAction && ((event.type === 'click' && !consent && !event.data.focusOnly) || (event.type === 'keydown' && event.data.key === 'Enter'))
    steps.push(event)
  }
  const navigations = steps.filter(e => ['navigation', 'frame-navigation'].includes(e.type)).length
  const interactions = steps.length - navigations
  if (!interactions) blockers.add(`There are no replayable interactions in this recording. Captured ${navigations} page navigation${navigations === 1 ? '' : 's'}, but no clicks, inputs, selections or scrolling. Use your saved recording, or start a new recording and perform the website task before stopping.`)
  return { steps, preview: { interactions, navigations, notes, inputs: recordingInputs(steps), steps: steps.length, startURL: steps.find(e => e.type === 'navigation')?.url ?? steps[0]?.url ?? null, blockers: [...blockers] } }
}
