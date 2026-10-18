import type { TargetDescriptor, PageEvidence } from './recording'
export interface PageRequest {
  op: 'describe' | 'locate' | 'inspect' | 'select' | 'scroll' | 'snapshot' | 'verify' | 'selectText' | 'focus' | 'checkSelect' | 'highlight' | 'clearHighlight'
  offset?: { x: number; y: number }
  target?: TargetDescriptor
  evidence?: PageEvidence
  values?: string[]
  x?: number
  y?: number
}
export interface PageResult {
  locatorStrategy?: string
  resolvedTarget?: TargetDescriptor
  target?: TargetDescriptor
  found?: boolean
  x?: number
  y?: number
  value?: string
  checked?: boolean
  values?: string[]
  selectionAll?: boolean
  focused?: boolean
  editable?: boolean
  inputType?: string
  expanded?: string
  pressed?: string
  text?: string
  evidence?: PageEvidence[]
  verified?: boolean
  scrollX?: number
  scrollMaxX?: number
  scrollMaxY?: number
  scrollY?: number
}

// Self-contained: this exact function is serialized into an isolated Chromium world.
// No website strings are interpolated as executable code.
export function pageOperation(request: PageRequest, source?: Element): PageResult {
  const norm = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
  const sensitive = /password|passwd|secret|token|api.?key|credit.?card|card.?number|cvv|cvc|security.?code|one.?time|otp|verification|recovery.?code|\bpin\b|cc-|card.?exp|card.?holder/i
  const secret = (el: Element) => sensitive.test(['type', 'name', 'id', 'autocomplete', 'aria-label', 'placeholder'].map(key => el.getAttribute(key) ?? '').join(' ') + ' ' + label(el)) || el.getAttribute('type') === 'file'
  const stable = (id: string) => !!id && !/(:|\d{4,}|[a-f\d]{8}-|^(react|radix|headlessui|mui)[-_])/i.test(id)
  const role = (el: Element) => el.getAttribute('role') || ({ BUTTON: 'button', A: el.hasAttribute('href') ? 'link' : '', TEXTAREA: 'textbox', SELECT: 'combobox', DIALOG: 'dialog', H1: 'heading', H2: 'heading', H3: 'heading', OPTION: 'option' } as Record<string, string>)[el.tagName] || (el instanceof HTMLInputElement ? ['checkbox', 'radio'].includes(el.type) ? el.type : ['button', 'submit'].includes(el.type) ? 'button' : 'textbox' : el instanceof HTMLElement && el.isContentEditable ? 'textbox' : '')
  const label = (el: Element) => norm((el as HTMLInputElement).labels ? [...((el as HTMLInputElement).labels ?? [])].map(item => { const copy = item.cloneNode(true) as Element; copy.querySelectorAll('input,textarea,select,[contenteditable]').forEach(control => control.remove()); return copy.textContent }).join(' ') : '')
  const name = (el: Element) => norm(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')?.split(/\s+/).map(id => el.ownerDocument.getElementById(id)?.textContent ?? '').join(' ') || label(el) || el.getAttribute('alt') || (el instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(el.type) ? el.value : '') || (['button', 'link', 'heading', 'option'].includes(role(el)) ? el.textContent : ''))
  const visible = (el: Element) => { const rect = el.getBoundingClientRect(); const style = getComputedStyle(el); return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0' && !el.closest('[inert],[aria-hidden="true"]') }
  const css = (el: Element): string => {
    if (el.id) return '#' + CSS.escape(el.id)
    if (el.getAttribute('data-testid')) return `[data-testid="${CSS.escape(el.getAttribute('data-testid')!)}"]`
    const parts: string[] = []
    let item: Element | null = el
    for (let depth = 0; item && depth < 8; depth++, item = item.parentElement) {
      if (item.id) { parts.unshift('#' + CSS.escape(item.id)); break }
      const siblings: Element[] = item.parentElement ? [...item.parentElement.children].filter(child => child.tagName === item!.tagName) : []
      parts.unshift(item.tagName.toLowerCase() + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(item) + 1})` : ''))
    }
    return parts.join(' > ')
  }
  const context = (el: Element) => {
    let parent = el.parentElement?.closest('[role="dialog"],dialog,[role="row"],tr,fieldset,section,form,[data-testid]')
    while (parent) {
      const value = { role: role(parent), name: name(parent) || norm(parent.querySelector('legend,h1,h2,h3')?.textContent), testId: parent.getAttribute('data-testid') || '', id: stable(parent.id) ? parent.id : '' }
      if (Object.values(value).some(Boolean)) return value
      parent = parent.parentElement?.closest('[role="dialog"],dialog,[role="row"],tr,fieldset,section,form,[data-testid]')
    }
    return undefined
  }
  const describe = (el: Element): TargetDescriptor => ({
    selector: css(el), tag: el.tagName.toLowerCase(), id: el.id, stableId: stable(el.id) ? el.id : '', testId: el.getAttribute('data-testid') || '',
    role: role(el), accessibleName: name(el), label: label(el), placeholder: el.getAttribute('placeholder') || '', name: el.getAttribute('name') || '',
    text: secret(el) || (el.matches('input,textarea,[contenteditable]') || !(role(el) === 'dialog' || !el.querySelector('input,textarea,[contenteditable]'))) ? '' : norm(el.textContent), inputType: el.getAttribute('type') || '', redacted: secret(el),
    attributes: Object.fromEntries(['name', 'type', 'title'].filter(key => el.hasAttribute(key)).map(key => [key, el.getAttribute(key)!])),
    context: context(el), frame: 'main', shadowHost: el.getRootNode() instanceof ShadowRoot ? css((el.getRootNode() as ShadowRoot).host) : null,
  })
  if (request.op === 'describe' && source) return { target: describe(source) }
  if (request.op === 'snapshot') {
    const nodes = [...document.querySelectorAll('[role="status"],[role="alert"],[role="dialog"],dialog,[aria-expanded],[aria-pressed]')]
    return { evidence: nodes.filter(el => visible(el) && !secret(el) && (role(el) === 'dialog' || !el.querySelector('input,textarea,[contenteditable]'))).slice(0, 80).map(el => ({ target: describe(el), text: ['status', 'alert'].includes(role(el)) ? norm(el.textContent) : undefined, expanded: el.getAttribute('aria-expanded') ?? undefined, pressed: el.getAttribute('aria-pressed') ?? undefined })) }
  }
  if (request.op === 'clearHighlight') { document.getElementById('ghost-replay-demo-overlay')?.remove(); return {} }
  const target = request.evidence?.target ?? request.target
  if (!target) throw new Error('No recorded target.')
  if (target.redacted && !target.credential) throw new Error('Manual authentication required. Sensitive targets cannot be automated.')
  let root: Document | ShadowRoot = document
  if (target.shadowHost) {
    const host = document.querySelector(target.shadowHost)
    if (!host?.shadowRoot) return { found: false }
    root = host.shadowRoot
  }
  const all = [...root.querySelectorAll('*')]
  const compatible = (el: Element) => (!target.tag || el.tagName.toLowerCase() === target.tag) && (!target.role || role(el) === target.role) && (!target.accessibleName || name(el) === target.accessibleName) && (!target.inputType || el.getAttribute('type') === target.inputType)
  const ranks: Element[][] = []
  const strategies: string[] = []
  const rank = (strategy: string, elements: Element[]) => { strategies.push(strategy); ranks.push(elements) }
  if (['html', 'body'].includes(target.tag ?? '') && ['scroll', 'inspect', 'locate'].includes(request.op)) rank('document', [target.tag === 'body' ? document.body : document.documentElement])
  if (target.testId) rank('test-id', all.filter(el => el.getAttribute('data-testid') === target.testId))
  if (target.stableId || (target.id && stable(target.id))) rank('stable-id', all.filter(el => el.id === (target.stableId || target.id)))
  if (target.role && (target.accessibleName || target.label)) rank('role-name', all.filter(el => role(el) === target.role && name(el) === (target.accessibleName || target.label)))
  if (target.label) rank('label', all.filter(el => label(el) === target.label))
  if (target.placeholder) rank('placeholder', all.filter(el => el.getAttribute('placeholder') === target.placeholder))
  if (target.name) rank('name', all.filter(el => el.getAttribute('name') === target.name))
  if (target.text) rank('text', all.filter(el => norm(el.textContent) === target.text))
  // Last resort for unnamed controls/containers: the captured DOM path.
  // Still require a unique compatible match and recorded surrounding context.
  if (target.selector && ((target.id && stable(target.id)) || target.testId || target.text || target.label || target.accessibleName || target.placeholder || (target.tag && !target.id))) {
    try { rank('css-fallback', [...root.querySelectorAll(target.selector)]) } catch { throw new Error('Invalid recorded selector.') }
  }
  let element: HTMLElement | undefined
  let locatorStrategy = ''
  for (const [rankIndex, candidatesAtRank] of ranks.entries()) {
    let candidates = candidatesAtRank.filter(compatible).filter(visible)
    if (!candidates.length) continue
    if (target.context && Object.values(target.context).some(Boolean) && (candidates.length > 1 || !['test-id', 'stable-id'].includes(strategies[rankIndex]))) candidates = candidates.filter(el => {
      const actual = context(el); return actual && Object.entries(target.context!).every(([key, value]) => !value || actual[key as keyof typeof actual] === value)
    })
    if (!candidates.length) continue
    if (candidates.length > 1) throw new Error('Ambiguous target: multiple elements match the recorded identity and context.')
    locatorStrategy = strategies[rankIndex]
    element = candidates[0] as HTMLElement
    break
  }
  if (request.op === 'verify' && request.evidence?.absent) return { verified: !element || !visible(element), found: !!element }
  if (!element || !visible(element)) return { found: false, verified: false }
  if (secret(element) && !target.credential) throw new Error('Manual authentication required. The live target is sensitive.')
  if (request.op === 'verify') {
    const evidence = request.evidence!
    return { found: true, verified: (evidence.text === undefined || norm(element.textContent) === evidence.text) && (evidence.expanded === undefined || element.getAttribute('aria-expanded') === evidence.expanded) && (evidence.pressed === undefined || element.getAttribute('aria-pressed') === evidence.pressed) }
  }
  if (element.matches(':disabled,[aria-disabled="true"]') || element.closest('[inert]')) return { found: false }
  const inspect = (): PageResult => ({ found: true, locatorStrategy, resolvedTarget: describe(element), value: element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement ? element.value : element.isContentEditable ? element.innerText : undefined,
    checked: element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type) ? element.checked : undefined,
    values: element instanceof HTMLSelectElement ? [...element.selectedOptions].map(o => o.value) : undefined,
    selectionAll: element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.selectionStart === 0 && element.selectionEnd === element.value.length : element.isContentEditable ? window.getSelection()?.toString() === element.textContent : false,
    focused: root.activeElement === element || (element.isContentEditable && element.contains(root.activeElement)), editable: element.matches('input,textarea') || element.isContentEditable,
    inputType: element instanceof HTMLInputElement ? element.type : undefined, text: norm(element.textContent), expanded: element.getAttribute('aria-expanded') ?? undefined, pressed: element.getAttribute('aria-pressed') ?? undefined,
    scrollMaxX: Math.max(0,element.scrollWidth-element.clientWidth), scrollMaxY: Math.max(0,element.scrollHeight-element.clientHeight), scrollX: element.scrollLeft, scrollY: element.scrollTop })
  if (request.op === 'highlight') {
    document.getElementById('ghost-replay-demo-overlay')?.remove()
    const rect = element.getBoundingClientRect()
    const overlay = document.createElement('div')
    overlay.id = 'ghost-replay-demo-overlay'
    overlay.setAttribute('aria-hidden', 'true')
    overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;contain:strict;'
    const shadow = overlay.attachShadow({ mode: 'closed' })
    const box = document.createElement('div')
    box.style.cssText = `position:absolute;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;box-sizing:border-box;border:3px solid #ffdf38;border-radius:6px;background:rgba(255,223,56,.12);box-shadow:0 0 0 4px rgba(255,223,56,.18);`
    const dot = document.createElement('div')
    dot.style.cssText = `position:absolute;left:${rect.x + rect.width * (request.offset?.x ?? .5) - 10}px;top:${rect.y + rect.height * (request.offset?.y ?? .5) - 10}px;width:20px;height:20px;border-radius:50%;background:#ffdf38;border:2px solid #171717;box-shadow:0 0 0 8px #ffdf3855;`
    shadow.append(box, dot); document.documentElement.append(overlay)
    setTimeout(() => overlay.remove(), 2200)
    return inspect()
  }
  if (request.op === 'inspect') return inspect()
  if (request.op === 'scroll') { element.scrollTo({ left: request.x ?? 0, top: request.y ?? 0, behavior: 'instant' }); return inspect() }
  if (!request.offset) element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
  const rect = element.getBoundingClientRect(), x = Math.round(rect.x + rect.width * (request.offset?.x ?? 0.5)), y = Math.round(rect.y + rect.height * (request.offset?.y ?? 0.5))
  const hit = root.elementFromPoint(x, y)
  if (request.offset ? hit !== element : hit !== element && !element.contains(hit)) return { found: false }
  if (request.op === 'select' || request.op === 'checkSelect') {
    if (!(element instanceof HTMLSelectElement)) throw new Error('Target is not a native select.')
    const available = request.values?.every(value => [...element!.querySelectorAll('option')].some(o => (o as HTMLOptionElement).value === value && !(o as HTMLOptionElement).disabled))
    if (request.op === 'checkSelect') return { found: true, verified: !!available }
    if (!available) throw new Error('Recorded option is unavailable.')
    for (const option of element.options) option.selected = request.values!.includes(option.value)
    element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }))
  }
  if (request.op === 'focus') element.focus({ preventScroll: true })
  if (request.op === 'selectText') {
    element.focus({ preventScroll: true })
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (element.readOnly) throw new Error('Input is read-only.')
      element.select()
    } else if (element.isContentEditable) {
      const range = document.createRange(); range.selectNodeContents(element); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
    } else throw new Error('Unsupported editable target.')
  }
  return { ...inspect(), x, y }
}
