import { ipcRenderer } from 'electron'
import { frameOperation } from '../shared/frameOperation'
import { pageOperation } from '../shared/pageOperation'
import type { PageEvidence } from '../shared/recording'

// Isolated, sandboxed preload: no API is exposed to the website.
let enabled = false
let readyReported = false
function reportReady() { if (enabled && !readyReported && document.readyState !== 'loading') { readyReported = true; emit('page-ready', { iframeCount: document.querySelectorAll('iframe,frame').length, framePolicy: 'frame-aware-v1' }) } }
const pausedValues = new WeakMap<Element, string>()
const capturedSecrets = new WeakMap<Element, string>()
const clip = (value: string | null | undefined, length = 500) => (value ?? '').slice(0, length)
function credential(element: Element) { return element instanceof HTMLInputElement && (element.type === 'password' || /one-time-code|otp|passcode|pin/i.test([element.autocomplete, element.name, element.id].join(' '))) }
function masked(element: Element) { return pageOperation({ op: 'describe' }, element).target?.redacted === true }
function target(element: Element) {
  const rect = element.getBoundingClientRect()
  return { ...pageOperation({ op: 'describe' }, element).target!, credential: credential(element), loginAction: !!element.closest('form')?.querySelector('input[type=password],input[autocomplete=one-time-code]'), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, cookieConsent: /cookie|consent/i.test(element.closest('[role=dialog],dialog,[id*=cookie],[class*=cookie],[id*=consent],[class*=consent]')?.textContent ?? '') }
}
let pendingOutcome: { id: string; element: Element; before: PageEvidence[] } | undefined
let outcomeTimer: ReturnType<typeof setTimeout> | undefined
let lastCause: { id: string; time: number; form?: HTMLFormElement | null } | undefined
function outcome() {
  if (!pendingOutcome) return
  const { id, element, before } = pendingOutcome
  const after = pageOperation({ op: 'snapshot' }).evidence ?? []
  const changed = after.filter(item => !before.some(old => JSON.stringify(old) === JSON.stringify(item)))
  for (const old of before) if (!after.some(item => item.target.selector === old.target.selector) && old.target.role === 'dialog') changed.push({ target: old.target, absent: true })
  if (!element.isConnected || !element.getBoundingClientRect().width) changed.push({ target: target(element), absent: true })
  if (changed.length) { emit('action-outcome', { actionId: id, evidence: changed.slice(0, 8) }) }
}
const observer = new MutationObserver(() => {
  if (!pendingOutcome) return
  if (outcomeTimer) clearTimeout(outcomeTimer)
  outcomeTimer = setTimeout(outcome, 100)
})
observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
function emit(type: string, data: Record<string, unknown>) {
  if (!enabled) return
  ipcRenderer.send('recorder:event', { type, url: location.href, data: { ...data, viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, scroll: { x: scrollX, y: scrollY }, pageTitle: clip(document.title), frame: 'main' } })
}
function eventTarget(event: Event) { const element = event.composedPath().find(item => item instanceof Element) as Element | undefined; return element?.closest('button,a[href],[role=button],input,textarea,select,[contenteditable=true]') ?? element }
function point(event: MouseEvent, element: Element) {
  const box = element.getBoundingClientRect()
  return { clientX: event.clientX, clientY: event.clientY, pageX: event.pageX, pageY: event.pageY, screenX: event.screenX, screenY: event.screenY, elementX: event.clientX - box.x, elementY: event.clientY - box.y, relativeX: box.width ? (event.clientX - box.x) / box.width : 0, relativeY: box.height ? (event.clientY - box.y) / box.height : 0, button: event.button, buttons: event.buttons, detail: event.detail, pointerType: event instanceof PointerEvent ? event.pointerType : 'mouse', modifiers: { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey } }
}
function input(element: Element) {
  if (enabled && credential(element)) capturedSecrets.set(element, (element as HTMLInputElement).value)
  const redacted = masked(element)
  const value = redacted ? '[REDACTED]' : element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement ? element.value : element.textContent ?? ''
  emit('input', { target: target(element), value: clip(value, 10000), ...(credential(element) ? { secretValue: (element as HTMLInputElement).value } : {}), truncated: !redacted && value.length > 10000, checked: element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type) ? element.checked : undefined, selectedValues: !redacted && element instanceof HTMLSelectElement ? [...element.selectedOptions].map(option => clip(option.value)) : undefined })
}
function flush() {
  // Autofill/password managers may not emit the usual trusted input event.
  // Capture current credentials before a submit/navigation/stop loses the DOM.
  if (enabled) for (const element of document.querySelectorAll<HTMLInputElement>('input')) {
    if (credential(element) && (element.value || capturedSecrets.has(element)) && capturedSecrets.get(element) !== element.value) input(element)
  }
  checkFrameFocus()
  if (scrollTimeout) { clearTimeout(scrollTimeout); scrollTimeout = undefined }
  for (const element of pendingScroll) emit('scroll', { target: target(element), scrollLeft: element.scrollLeft, scrollTop: element.scrollTop }); pendingScroll.clear()
  outcome()
}
ipcRenderer.on('recorder:enabled', (_event, value: boolean) => {
  enabled = value === true
  reportReady()
  checkFrameFocus()
  if (!enabled) { pendingOutcome = undefined; pendingScroll.clear(); if (scrollTimeout) clearTimeout(scrollTimeout) }
})
ipcRenderer.on('recorder:flush', () => { flush(); ipcRenderer.send('recorder:flushed') })
ipcRenderer.on('recorder:request', async (_event, message) => {
  try {
    if (message.operation === 'settle') await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const result = message.operation === 'settle' ? undefined : message.operation === 'flush' ? flush() : message.operation === 'owner' ? frameOperation(message.request) : pageOperation(message.request)
    ipcRenderer.send('recorder:response', { id: message.id, result })
  } catch (error) { ipcRenderer.send('recorder:response', { id: message.id, error: error instanceof Error ? error.message : 'Frame operation failed.' }) }
})
ipcRenderer.send('recorder:ready', { sandboxed: process.sandboxed })
for (const type of ['click', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup'] as const) {
  document.addEventListener(type, event => {
    const element = eventTarget(event); if (!enabled || !event.isTrusted || !element) return
    flush()
    const actionId = crypto.randomUUID()
    if (type === 'click') {
      pendingOutcome = { id: actionId, element, before: pageOperation({ op: 'snapshot' }).evidence ?? [] }
      lastCause = { id: actionId, time: performance.now(), form: element instanceof HTMLButtonElement || element instanceof HTMLInputElement ? element.form : null }
      outcomeTimer = setTimeout(outcome, 100)
    }
    const descriptor = target(element)
    const background = type === 'click' && ['form', 'div', 'section', 'main', 'body', 'html'].includes(descriptor.tag ?? '') && !descriptor.role && !descriptor.accessibleName && !descriptor.text
    emit(type, { actionId, target: descriptor, pointer: point(event, element), ...(background ? { background: true } : {}) })
    if (background) queueMicrotask(() => { if (document.activeElement) emit('focus-outcome', { actionId, target: target(document.activeElement) }) })
  }, true)
}
let pendingTab: string | undefined
document.addEventListener('focusin', event => {
 if (!pendingTab || !enabled) return
 const element = eventTarget(event)
 if (element) emit('focus-outcome', { actionId: pendingTab, target: target(element) })
 pendingTab = undefined
}, true)
let lastMove = 0
document.addEventListener('pointermove', event => { if (!event.isTrusted || !event.buttons || performance.now() - lastMove < 100) return; lastMove = performance.now(); const element = eventTarget(event); if (element) emit('drag-move', { target: target(element), pointer: point(event, element) }) }, true)
for (const type of ['input', 'change'] as const) document.addEventListener(type, event => {
  const element = eventTarget(event); if (!event.isTrusted || !element) return
  const fingerprint = masked(element) && !credential(element) ? '[REDACTED]' : element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement ? JSON.stringify([element.value, element instanceof HTMLInputElement ? element.checked : null]) : element.textContent ?? ''
  if (!enabled) { pausedValues.set(element, fingerprint); return }
  if (pausedValues.get(element) === fingerprint) return
  pausedValues.delete(element)
  input(element)
}, true)
document.addEventListener('keydown', event => {
  const element = eventTarget(event)
  if (!event.isTrusted || !element || (masked(element) && !credential(element))) return
  if ((event.ctrlKey || event.metaKey) && !event.altKey && ['v', 'x', 'z', 'y'].includes(event.key.toLowerCase()) && element.matches('input:not([type=password]),textarea,[contenteditable=true]')) {
    emit('edit-shortcut', { target: target(element), key: event.key.toLowerCase() }); return
  }
  // Printable text is captured as a field value, never as a global keylogger.
  if ((event.ctrlKey || event.metaKey || event.altKey) && event.key.length === 1 && !((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a')) { emit('unsupported', { reason: 'This shortcut is not yet supported by verified replay. Use the field editor for replacement text.' }); return }
  if (!((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') && !['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return
  flush(); const actionId = crypto.randomUUID(); pendingTab = event.key === 'Tab' ? actionId : undefined; lastCause = { id: actionId, time: performance.now(), form: element.closest('form') }; pendingOutcome = { id: actionId, element, before: pageOperation({ op: 'snapshot' }).evidence ?? [] }; emit('keydown', { actionId, target: target(element), key: event.key, code: event.code, modifiers: { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey } })
}, true)
let scrollTimeout: ReturnType<typeof setTimeout> | undefined
const pendingScroll = new Set<Element>()
document.addEventListener('scroll', event => {
  if (!enabled || !event.isTrusted) return
  if (scrollTimeout) clearTimeout(scrollTimeout)
  const element = event.target instanceof Element ? event.target : document.scrollingElement
  if (element) pendingScroll.add(element)
  scrollTimeout = setTimeout(() => { scrollTimeout = undefined; for (const item of pendingScroll) emit('scroll', { target: target(item), scrollLeft: item.scrollLeft, scrollTop: item.scrollTop }); pendingScroll.clear() }, 150)
}, true)
document.addEventListener('submit', event => { if (!event.isTrusted) return; flush(); const element = eventTarget(event); if (element) emit('submit', { target: target(element), causedBy: lastCause?.form === element && performance.now() - lastCause.time < 1500 ? lastCause.id : undefined }) }, true)
window.addEventListener('pagehide', flush)
window.addEventListener('DOMContentLoaded', reportReady)
// Report entry so main can verify that the child has its own sandboxed recorder.
const reportedFrames = new WeakSet<Element>()
function reportFrame(element: Element) {
  if (!enabled || reportedFrames.has(element)) return
  reportedFrames.add(element)
  const frame = element as HTMLIFrameElement
  emit('frame-entry', { child: { name: frame.name || '', url: frame.src || 'about:blank' } })
}
function checkFrameFocus() {
  let active = document.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  if (active instanceof HTMLIFrameElement || active instanceof HTMLFrameElement) reportFrame(active)
}
// Chromium can update activeElement after the blur callback, so check both now
// and in the next task. Flush checks it again before stop/pause acknowledges.
window.addEventListener('blur', () => { checkFrameFocus(); setTimeout(checkFrameFocus, 0) })
window.addEventListener('focus', checkFrameFocus)
document.addEventListener('focusin', checkFrameFocus, true)
document.addEventListener('load', event => {
  if (event.target instanceof HTMLIFrameElement || event.target instanceof HTMLFrameElement) reportedFrames.delete(event.target)
}, true)
// Wheel and hover do not bubble out of frames: confirm child capture on entry.
document.addEventListener('pointerover', event => {
  if (!event.isTrusted) return
  const frame = event.composedPath().find(item => item instanceof HTMLIFrameElement || item instanceof HTMLFrameElement)
  if (frame instanceof Element) reportFrame(frame)
}, true)
