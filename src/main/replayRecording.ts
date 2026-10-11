import type { BrowserWindow, WebContents } from 'electron'
import type { ActionResult, PageEvidence, RecordedEvent, ReplayStatus, TargetDescriptor } from '../shared/recording'
import { pageOperation, type PageRequest, type PageResult } from '../shared/pageOperation'
import { browserURL } from './browserAddress'

export function sameDestination(actual: string, expected: string) {
  const normalize = (value: string) => { const url = new URL(value); url.searchParams.sort(); return url.href }
  return normalize(actual) === normalize(expected)
}
export async function replayRecording(contents: WebContents, owner: BrowserWindow, steps: RecordedEvent[], signal: AbortSignal, report: (status: ReplayStatus) => void, approve: (event: RecordedEvent) => Promise<boolean>, visible: () => boolean = () => true) {
  const results: ActionResult[] = steps.map(e => ({ sequence: e.sequence, type: e.type, state: 'pending' }))
  let attached = false
  let current: RecordedEvent | undefined, result: ActionResult | undefined, dispatched = false
  const status = (state: ReplayStatus['state'], error: string | null = null): ReplayStatus => ({ state, completed: results.filter(r => ['verified', 'skipped'].includes(r.state)).length, total: steps.length, sequence: current?.sequence ?? null, action: current ? `${current.type}: ${(current.data.target as TargetDescriptor | undefined)?.accessibleName || (current.data.target as TargetDescriptor | undefined)?.label || (current.data.target as TargetDescriptor | undefined)?.text || 'recorded target'}` : 'Preparing', error, results: results.map(r => ({ ...r })) })
  const check = () => { if (signal.aborted || contents.isDestroyed() || owner.isDestroyed()) throw new Error('Replay cancelled.') }
  async function bounded<T>(promise: Promise<T>, timeout = 10000): Promise<T> {
    let timer: ReturnType<typeof setInterval> | undefined
    try { return await Promise.race([promise, new Promise<never>((_resolve, reject) => { const start = Date.now(); timer = setInterval(() => { try { check(); if (Date.now() - start >= timeout) reject(new Error('Timed out waiting for the browser.')) } catch (error) { reject(error) } }, 50) })]) }
    finally { clearInterval(timer) }
  }
  async function until<T>(test: () => Promise<T> | T, message: string, timeout = 10000): Promise<NonNullable<Exclude<T, false>>> {
    const start = Date.now()
    do { check(); const value = await test(); if (value) return value as NonNullable<Exclude<T, false>>; await new Promise(resolve => setTimeout(resolve, 50)) } while (Date.now() - start < timeout)
    throw new Error(message)
  }
  const page = (request: PageRequest) => bounded(contents.executeJavaScriptInIsolatedWorld(1002, [{ code: `(${pageOperation.toString()})(${JSON.stringify(request)})` }])) as Promise<PageResult>
  const command = (method: string, params: Record<string, unknown> = {}) => bounded(contents.debugger.sendCommand(method, params))
  const key = async (key: string, code: string, virtualKey: number, modifiers = 0) => { await command('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey, modifiers }); await command('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey, modifiers }) }
  const targetOf = (event: RecordedEvent) => event.data.target as TargetDescriptor
  async function ready() {
    await until(() => visible() && owner.isVisible() && !owner.isMinimized(), 'The browser viewport is hidden. Close the dialog or restore the window.')
    owner.focus(); contents.focus()
    await command('Emulation.setFocusEmulationEnabled', { enabled: true })
    await until(() => !contents.isLoading(), 'The page did not finish loading.', 15000)
  }
  async function locate(event: RecordedEvent) {
    return until(async () => { const found = await page({ op: 'locate', target: targetOf(event) }); return found.found && found }, 'The intended element is missing, disabled, covered, or not ready.')
  }
  async function click(event: RecordedEvent) {
    const point = await locate(event)
    check(); dispatched = true
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x!, y: point.y! })
    await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x!, y: point.y!, button: 'left', clickCount: 1 })
    await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x!, y: point.y!, button: 'left', clickCount: 1 })
  }
  async function verifyEvidence(evidence: PageEvidence[]) {
    for (const item of evidence) if (!(await page({ op: 'verify', evidence: item })).verified) return false
    return true
  }
  report(status('running'))
  try {
    check()
    if (!steps.length) throw new Error('Empty recording.')
    if (contents.debugger.isAttached()) throw new Error('The browser debugger is already in use. Close developer tools before replay.')
    contents.debugger.attach('1.3'); attached = true
    await ready()
    const firstURL = steps.find(e => e.type === 'navigation')?.url ?? steps[0].url
    await bounded(contents.loadURL(browserURL(firstURL)), 20000)
    await until(() => sameDestination(contents.getURL(), firstURL), 'The starting page redirected to an unexpected destination. Sign in manually before recording.', 10000)
    for (let index = 0; index < steps.length; index++) {
      current = steps[index]; result = results[index]; dispatched = false
      result.state = 'running'; report(status('running'))
      await ready()
      const event = current, target = targetOf(event)
      if (event.type === 'navigation') {
        if (!sameDestination(contents.getURL(), event.url)) {
          if (event.data.source === 'address' || index === 0) await bounded(contents.loadURL(browserURL(event.url)), 20000)
          await until(() => sameDestination(contents.getURL(), event.url), 'Expected navigation was not reached; the destination differs from the recording.')
        }
        result.evidence = 'Expected destination reached.'
      } else {
        if (new URL(contents.getURL()).origin !== new URL(event.url).origin) throw new Error('Unexpected website or login redirect. Authenticate manually; replay stopped.')
        if (event.data.optionalCookieConsent) {
          // Require consecutive absence observations, rather than an immediate missing selector.
          const absent = await page({ op: 'locate', target })
          if (!absent.found) {
            let appeared = false
            const start = Date.now()
            while (Date.now() - start < 1000) { check(); if ((await page({ op: 'locate', target })).found) { appeared = true; break } await new Promise(resolve => setTimeout(resolve, 100)) }
            if (!appeared) { result.state = 'skipped'; result.evidence = 'Optional cookie target absent for one second; no consent action performed.'; report(status('running')); continue }
          }
        }
        await locate(event)
        if (event.data.requiresApproval) {
          result.state = 'needs-user-approval'; report(status('needs-user-approval'))
          if (!await bounded(approve(event), 300000)) throw new Error('Action was not approved. No action dispatched.')
          result.state = 'running'; report(status('running')); await ready(); await locate(event)
        }
        if (event.type === 'input') {
          const inspect = () => page({ op: 'inspect', target })
          if (typeof event.data.checked === 'boolean') {
            if ((await inspect()).checked !== event.data.checked) await click(event)
            await until(async () => (await inspect()).checked === event.data.checked, 'Checkbox/radio state did not match.')
          } else if (Array.isArray(event.data.selectedValues)) {
            await page({ op: 'select', target, values: event.data.selectedValues as string[] }); dispatched = true
            await until(async () => JSON.stringify((await inspect()).values) === JSON.stringify(event.data.selectedValues), 'Selected options did not match.')
          } else {
            await page({ op: 'selectText', target }); check()
            const value = String(event.data.value ?? '')
            dispatched = true
            if (value) await command('Input.insertText', { text: value })
            else await key('Backspace', 'Backspace', 8)
            await until(async () => (await inspect()).value?.replace(/\r\n/g, '\n') === value.replace(/\r\n/g, '\n'), 'The field/editor did not retain the intended value.')
          }
          result.evidence = 'Recorded field state verified in the live page.'
        } else if (event.type === 'scroll') {
          await page({ op: 'scroll', target, x: Number(event.data.scrollLeft), y: Number(event.data.scrollTop) })
          await until(async () => { const state = await page({ op: 'inspect', target }); return Math.abs((state.scrollX ?? 0) - Number(event.data.scrollLeft)) <= 2 && Math.abs((state.scrollY ?? 0) - Number(event.data.scrollTop)) <= 2 }, 'The recorded scroll offset is unreachable.')
          result.evidence = 'Scroll offset verified.'
        } else {
          const evidence = (event.data.evidence ?? []) as PageEvidence[]
          const next = steps[index + 1]
          const expectsNavigation = next?.type === 'navigation' && next.data.source !== 'address'
          const focusOnly = event.type === 'click' && event.data.focusOnly === true
          if (evidence.length && !focusOnly && !expectsNavigation && await verifyEvidence(evidence)) throw new Error('Expected outcome already exists. Initial state differs; action not executed.')
          if (event.type === 'click' && target.tag === 'select') await page({ op: 'focus', target })
          else if (event.type === 'click') await click(event)
          else if (event.type === 'keydown') {
            await page({ op: 'focus', target })
            const keys: Record<string, number> = { a: 65, A: 65, Enter: 13, Tab: 9, Escape: 27, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35, PageUp: 33, PageDown: 34 }
            const keyName = String(event.data.key), virtualKey = keys[keyName]; if (!virtualKey) throw new Error('Unsupported keyboard action.')
            const mods = event.data.modifiers as Record<string, boolean> | undefined
            const modifiers = (mods?.alt ? 1 : 0) | (mods?.ctrl ? 2 : 0) | (mods?.meta ? 4 : 0) | (mods?.shift ? 8 : 0)
            dispatched = true; await key(keyName, keyName.toLowerCase() === 'a' ? 'KeyA' : keyName, virtualKey, modifiers)
          } else throw new Error(`Unsupported execution: ${event.type}`)
          if (expectsNavigation) await until(() => sameDestination(contents.getURL(), next.url), 'The action did not reach its recorded destination.')
          else if (event.type === 'keydown' && String(event.data.key).toLowerCase() === 'a' && ((event.data.modifiers as Record<string, boolean>)?.ctrl || (event.data.modifiers as Record<string, boolean>)?.meta)) await until(async () => (await page({ op: 'inspect', target })).selectionAll, 'Select-all shortcut did not select the field contents.')
          else if (focusOnly) await until(async () => (await page({ op: 'inspect', target })).focused, 'The input did not receive focus.')
          else if (evidence.length) await until(() => verifyEvidence(evidence), 'Action sent, but its recorded outcome was not observed. Do not retry automatically.')
          else throw new Error('Action sent, but this recording has no verifiable outcome. Review the website manually; no further actions were run.')
          result.evidence = expectsNavigation ? 'Resulting navigation verified.' : focusOnly ? 'Editable target focus verified.' : 'Recorded observable page outcome verified (not a business-success assertion).'
        }
      }
      result.state = 'verified'; report(status('running'))
    }
    report(status('completed'))
  } catch (error) {
    if (result) { result.state = dispatched ? 'unknown' : 'failed'; result.evidence = signal.aborted ? 'Cancelled; any dispatched action may already have taken effect.' : error instanceof Error ? error.message : String(error) }
    if (!contents.isDestroyed()) contents.stop()
    report(status(signal.aborted ? 'cancelled' : dispatched ? 'unknown' : 'failed', error instanceof Error ? error.message : String(error)))
  } finally {
    if (attached && !contents.isDestroyed() && contents.debugger.isAttached()) {
      await Promise.race([contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: false }).catch(() => {}), new Promise(resolve => setTimeout(resolve, 1000))])
      contents.debugger.detach()
    }
  }
}
