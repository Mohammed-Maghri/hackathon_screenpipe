import { ReplayFailure, failureCode, diagnosticTarget, transientDOMError } from './replayDiagnostics'
import { recordedURL } from '../shared/recordedURL'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { BrowserWindow, WebContents, DownloadItem, Event } from 'electron'
import type { FrameIdentity, ActionResult, PageEvidence, RecordedEvent, ReplayStatus, TargetDescriptor } from '../shared/recording'
import { pageOperation, type PageRequest, type PageResult } from '../shared/pageOperation'
import type { FrameBridge } from './frameBridge'
import { browserURL } from './browserAddress'

export function sameDestination(actual: string, expected: string) {
  const normalize = (value: string) => { const url = new URL(value); url.searchParams.sort(); return url.href }
  return normalize(actual) === normalize(expected)
}
export async function replayRecording(contents: WebContents, owner: BrowserWindow, steps: RecordedEvent[], signal: AbortSignal, report: (status: ReplayStatus) => void | Promise<void>, approve: (event: RecordedEvent) => Promise<boolean>, visible: () => boolean = () => true, frames?: FrameBridge, authenticate?: (targetURL: string, progress: (action: string) => Promise<void>) => Promise<void>, decryptInput?: (event: RecordedEvent) => string, options: { resume?: ReplayStatus; timeout?: number; authorized?: boolean; demo?: boolean } = {}) {
  const results: ActionResult[] = options.resume?.results ? structuredClone(options.resume.results) : steps.map(e => ({ sequence: e.sequence, type: e.type, state: 'pending' }))
  let attached = false, currentIndex = options.resume?.currentActionIndex ?? 0, lastVerified = options.resume?.lastVerifiedCheckpoint ?? -1, documentToken = options.resume?.documentToken
  let phase: 'precondition' | 'execution' | 'verification' = 'precondition'
  const timeout = options.timeout ?? 10000
  let current: RecordedEvent | undefined, result: ActionResult | undefined, dispatched = false
  const status = (state: ReplayStatus['state'], error: string | null = null): ReplayStatus => ({ state, artifacts: [...(options.resume?.artifacts ?? []), ...downloads.map(file => ({ id: basename(file.path), filename: file.filename, path: file.path, bytes: file.bytes, mimeType: file.mimeType, state: file.state, sequence: file.sequence }))], currentActionIndex: currentIndex, lastVerifiedCheckpoint: lastVerified, observedURL: contents.isDestroyed() || !contents.getURL() ? undefined : recordedURL(contents.getURL()).url, documentToken, resumable: ['failed', 'unknown', 'cancelled'].includes(state), failureCode: result?.diagnostics?.failureCode, completed: results.filter(r => ['verified', 'skipped'].includes(r.state)).length, total: steps.length, sequence: current?.sequence ?? null, action: current ? `${current.type}: action ${current.sequence}` : 'Preparing', error, results: results.map(r => ({ ...r })) })
  const downloads: { item: DownloadItem; filename: string; mimeType: string; state: string; path: string; bytes: number; sequence: number }[] = []
  let downloadError = ''
  const onDownload = (_event: Event, item: DownloadItem, source: WebContents) => {
    if (source !== contents) return
    if (!current?.data.expectedDownloads || !dispatched) { item.cancel(); downloadError = 'An unexpected download started. Replay stopped.'; return }
    const download = { item, filename: basename(item.getFilename()).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'download', mimeType: item.getMimeType(), state: 'progressing', path: item.getSavePath(), bytes: 0, sequence: current?.sequence ?? 0 }
    downloads.push(download)
    item.once('done', (_event, state) => { download.state = state; download.path = item.getSavePath(); download.bytes = item.getReceivedBytes() })
  }
  contents.session.on('will-download', onDownload)
  const check = () => { if (downloadError) throw new Error(downloadError); if (signal.aborted || contents.isDestroyed() || owner.isDestroyed()) throw new ReplayFailure('CANCELLED', 'Replay cancelled.') }
  async function bounded<T>(promise: Promise<T>, timeout = 10000): Promise<T> {
    let timer: ReturnType<typeof setInterval> | undefined
    try { return await Promise.race([promise, new Promise<never>((_resolve, reject) => { const start = Date.now(); timer = setInterval(() => { try { check(); if (Date.now() - start >= timeout) reject(new Error('Timed out waiting for the browser.')) } catch (error) { reject(error) } }, 50) })]) }
    finally { clearInterval(timer) }
  }
  async function until<T>(test: () => Promise<T> | T, message: string, limit = timeout): Promise<NonNullable<Exclude<T, false>>> {
    const start = Date.now()
    do {
      check()
      try { const value = await test(); if (value) return value as NonNullable<Exclude<T, false>> }
      catch (error) { if (!transientDOMError(error)) throw error; if (result?.diagnostics) result.diagnostics.recoveryAttempts++ }
      await new Promise(resolve => setTimeout(resolve, 50))
    } while (Date.now() - start < limit)
    throw new ReplayFailure(phase === 'precondition' ? 'TARGET_NOT_FOUND' : 'VERIFICATION_TIMEOUT', message)
  }

  const pathOf = (event?: RecordedEvent) => (event?.data.framePath ?? []) as FrameIdentity[]
  const page = async (request: PageRequest): Promise<PageResult> => {
    const path = pathOf(current)
    if (path.length) {
      if (!frames) throw new Error('Frame-aware replay is unavailable.')
      return bounded(frames.page(path, request, signal))
    }
    // Electron otherwise collapses thrown page errors into "Script failed".
    // Return an envelope so locator ambiguity survives the isolated-world boundary.
    const envelope = await bounded(contents.executeJavaScriptInIsolatedWorld(1002, [{ code: `(()=>{try{return {result:(${pageOperation.toString()})(${JSON.stringify(request)})}}catch(error){return {error:String(error.message)}}})()` }])) as { result?: PageResult; error?: string }
    if (envelope.error) {
      const code = failureCode(envelope.error)
      throw new ReplayFailure(code, code === 'TARGET_AMBIGUOUS' ? 'Multiple live elements match the recorded target.' : code === 'TARGET_NOT_FOUND' ? 'The live target is unavailable.' : code === 'ACTION_UNSUPPORTED' ? 'The requested page operation is unsupported.' : 'Live DOM inspection failed.')
    }
    return envelope.result!

  }
  const reachedFrameDestination = (event: RecordedEvent) => {
    const path = pathOf(event).map(item => ({ ...item }))
    if (!path.length || typeof event.data.destination !== 'string' || !frames) throw new Error('Invalid recorded frame navigation.')
    path[path.length - 1]!.url = event.data.destination
    try { return sameDestination(frames.resolve(path).url, event.data.destination) } catch (error) { if (String(error).includes('Ambiguous')) throw error; return false }
  }
  const command = async (method: string, params: Record<string, unknown> = {}) => {
    check()
    try { return await bounded(contents.debugger.sendCommand(method, params)) }
    catch (error) { if (signal.aborted) throw error; throw new ReplayFailure('EXECUTION_FAILED', `Browser command failed: ${method}.`) }
  }
  async function demoPause(milliseconds: number) {
    const end = Date.now() + milliseconds
    while (Date.now() < end) { check(); await new Promise(resolve => setTimeout(resolve, Math.min(50, end - Date.now()))) }
  }
  async function saveDispatch() {
    check(); phase = 'execution'; dispatched = true
    if (result?.diagnostics) result.diagnostics.execution = 'dispatching'
    // Persist intent BEFORE the operation. A crash here must not permit a blind retry.
    await report(status('running'))
  }
  async function token() {
    return String(await bounded(contents.executeJavaScript('performance.timeOrigin'), 2000))
  }
  const key = async (key: string, code: string, virtualKey: number, modifiers = 0) => { await command('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey, modifiers }); await command('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey, modifiers }) }
  const targetOf = (event: RecordedEvent) => event.data.target as TargetDescriptor
  async function ready() {
    await until(() => visible() && owner.isVisible() && !owner.isMinimized(), 'The browser viewport is hidden. Close the dialog or restore the window.')
    owner.focus(); contents.focus()
    await command('Emulation.setFocusEmulationEnabled', { enabled: true })
    await until(() => !contents.isLoading(), 'The page did not finish loading.', 15000)
  }
  async function locate(event: RecordedEvent) {
    return until(async () => {
      try {
        if (pathOf(event).length) await bounded(frames!.point(pathOf(event)))
        if (result?.diagnostics) result.diagnostics.locatorAttempts++
        const pointer = event.data.pointer as { relativeX?: number; relativeY?: number } | undefined
        const offset = event.data.background && pointer && Number.isFinite(pointer.relativeX) && Number.isFinite(pointer.relativeY) ? { x: Math.max(0, Math.min(1, pointer.relativeX!)), y: Math.max(0, Math.min(1, pointer.relativeY!)) } : undefined
        const found = await page({ op: 'locate', target: targetOf(event), offset })
        if (found.found && result?.diagnostics) { result.diagnostics.resolvedTarget = diagnosticTarget(found.resolvedTarget); result.diagnostics.locatorStrategy = found.locatorStrategy }

        if (!found.found) { if (result?.diagnostics) result.diagnostics.recoveryAttempts++; return false }
        if (pathOf(event).length) { const translated = await bounded(frames!.point(pathOf(event), { x: found.x!, y: found.y! })); return { ...found, ...translated } }
        return found
      } catch (error) { if (/missing|not ready|unavailable|owner not found/i.test(String(error))) return false; throw error }
    }, 'The intended element is missing, disabled, covered, or not ready.')
  }
  async function click(event: RecordedEvent) {
    await locate(event)
    if (frames) await bounded(frames.settle(pathOf(event)))
    const point = await locate(event)
    await saveDispatch()
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x!, y: point.y! })
    await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x!, y: point.y!, button: 'left', clickCount: 1 })
    await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x!, y: point.y!, button: 'left', clickCount: 1 })
  }
  async function verifyEvidence(evidence: PageEvidence[]) {
    for (const item of evidence) if (!(await page({ op: 'verify', evidence: item })).verified) return false
    return true
  }

  const transition = (index: number) => {
    const next = steps.slice(index + 1).find(step => step.type !== 'scroll')
    return next && ((next.type === 'navigation' && next.data.source !== 'address') || next.type === 'frame-navigation') ? next : undefined
  }
  const evidenceOf = (event: RecordedEvent) => (event.data.evidence ?? []) as PageEvidence[]
  const supported = (event: RecordedEvent, index: number) => {
    if (['input', 'scroll', 'navigation', 'frame-navigation'].includes(event.type)) return true
    if (!['click', 'keydown'].includes(event.type)) return false
    return !!(event.data.expectedDownloads || transition(index) || event.data.focusOnly || event.data.focusTarget || evidenceOf(event).length ||
      (event.type === 'keydown' && (event.data.key === 'Tab' || String(event.data.key).toLowerCase() === 'a')))
  }
  async function observed(event: RecordedEvent, index: number): Promise<boolean> {
    const target = targetOf(event)
    if (event.type === 'navigation') return sameDestination(contents.getURL(), event.url)
    if (event.type === 'frame-navigation') return reachedFrameDestination(event)
    if (event.data.expectedDownloads) return false // Requires live download tracking; never infer on resume.
    const next = transition(index)
    if (next && event.type !== 'input' && event.type !== 'scroll') return next.type === 'frame-navigation' ? reachedFrameDestination(next) : sameDestination(contents.getURL(), next.url)
    if (new URL(contents.getURL()).origin !== new URL(event.url).origin) return false
    if (event.type === 'input') {
      const state = await page({ op: 'inspect', target })
      if (!state.found) return false
      if (typeof event.data.checked === 'boolean') return state.checked === event.data.checked
      if (Array.isArray(event.data.selectedValues)) return JSON.stringify(state.values) === JSON.stringify(event.data.selectedValues)
      const value = event.data.encryptedValue ? decryptInput!(event) : String(event.data.value ?? '')
      return state.value?.replace(/\r\n/g, '\n') === value.replace(/\r\n/g, '\n')
    }
    if (event.type === 'scroll') { const state = await page({ op: 'inspect', target }); return state.found === true && Math.abs((state.scrollX ?? 0) - Number(event.data.scrollLeft)) <= 2 && Math.abs((state.scrollY ?? 0) - Number(event.data.scrollTop)) <= 2 }
    if (event.data.focusTarget && (event.data.background || (event.type === 'keydown' && event.data.key === 'Tab'))) return (await page({ op: 'inspect', target: event.data.focusTarget as TargetDescriptor })).focused === true
    if (event.data.focusOnly) return (await page({ op: 'inspect', target })).focused === true
    if (event.type === 'keydown' && event.data.key === 'Tab') return (await page({ op: 'inspect', target })).focused === false
    if (event.type === 'keydown' && String(event.data.key).toLowerCase() === 'a') return (await page({ op: 'inspect', target })).selectionAll === true
    return evidenceOf(event).length > 0 && await verifyEvidence(evidenceOf(event))
  }
  async function verifyCurrent(event: RecordedEvent, index: number) {
    phase = 'verification'
    if (result?.diagnostics) { result.diagnostics.execution = dispatched ? 'dispatched' : 'not-needed'; result.diagnostics.verification = 'waiting' }
    await report(status('running'))
    try { await until(() => observed(event, index), 'Expected action result was not observed.') }
    catch (error) {
      if (!(error instanceof ReplayFailure) || error.code !== 'VERIFICATION_TIMEOUT') throw error
      if (result?.diagnostics) result.diagnostics.recoveryAttempts++
      await until(() => observed(event, index), 'Expected action result was not observed after bounded recovery.', Math.min(timeout, 2000))
    }
  }
  if (!options.resume) await report(status('running'))
  try {
    check()
    if (!steps.length) throw new Error('Empty recording.')
    const initialURL = steps.find(e => e.type === 'navigation')?.url ?? steps[0].url
    if (authenticate && !options.resume) {
      await until(() => visible() && owner.isVisible() && !owner.isMinimized() && !contents.isLoading(), 'The browser must finish opening before sign-in.', 20000)
      await authenticate(initialURL, async action => { await report({...status('running'), action: 'Login: '+action}) })
    }
    check()
    if (contents.debugger.isAttached()) throw new Error('The browser debugger is already in use. Close developer tools before replay.')
    contents.debugger.attach('1.3'); attached = true
    await ready()
    const firstURL = steps.find(e => e.type === 'navigation')?.url ?? steps[0].url
    if (options.resume) {
      const saved = options.resume
      if (saved.results?.length !== steps.length || saved.results.some((item, i) => item.sequence !== steps[i].sequence)) throw new ReplayFailure('RESUME_REJECTED', 'Recording plan changed; cannot resume.')
      if (!saved.observedURL || !sameDestination(contents.getURL(), saved.observedURL) || await token() !== saved.documentToken) throw new ReplayFailure('RESUME_REJECTED', 'The page changed or reloaded. Resume cannot revalidate this browser document.')
      currentIndex = Math.min(saved.currentActionIndex ?? 0, steps.length - 1)
      if (['verified', 'skipped'].includes(results[currentIndex].state)) currentIndex++
      // Revalidate the last checkpoint before executing a previously undispatched action.
      if (currentIndex < steps.length && !['dispatching', 'dispatched'].includes(results[currentIndex].diagnostics?.execution ?? '') && lastVerified >= 0) {
        current = steps[lastVerified]
        if (current.data.expectedDownloads || !(await observed(current, lastVerified))) throw new ReplayFailure('RESUME_REJECTED', 'Last verified checkpoint no longer matches the live page.')
      }
    } else {
      await bounded(contents.loadURL(browserURL(firstURL)), 20000)
      await until(() => sameDestination(contents.getURL(), firstURL), 'The starting page redirected to an unexpected destination.', 10000)
    }
    documentToken = await token()
    for (let index = currentIndex; index < steps.length; index++) {
      currentIndex = index; current = steps[index]; result = results[index]; dispatched = false; phase = 'precondition'
      const priorExecution = result.diagnostics?.execution
      result.diagnostics = { recordedTarget: diagnosticTarget(targetOf(current)), precondition: 'checking', execution: 'not-dispatched', verification: 'not-started', recoveryAttempts: 0, locatorAttempts: 0 }
      if (options.resume && index === options.resume.currentActionIndex && ['dispatching', 'dispatched'].includes(priorExecution ?? '')) {
        result.diagnostics.execution = priorExecution!
        result.diagnostics.recoveryAttempts++
        if (current.data.expectedDownloads) throw new ReplayFailure('OUTCOME_UNKNOWN', 'Interrupted download action requires manual inspection; it will not be repeated.')
        dispatched = true
        try { await verifyCurrent(current, index) } catch { throw new ReplayFailure('OUTCOME_UNKNOWN', 'Previously dispatched action remains uncertain. It will not be repeated.') }
        result.state = 'verified'; result.diagnostics.verification = 'satisfied'; result.evidence = 'Previously dispatched result revalidated without repeating the action.'
        lastVerified = index; await report(status('running')); continue
      }
      if (!supported(current, index)) throw new ReplayFailure('ACTION_UNSUPPORTED', 'This action has no supported observable postcondition. No action was dispatched.')
      result.state = 'running'; await report(status('running'))
      await ready()
      const event = current, target = targetOf(event)
      if (event.type === 'frame-navigation') {
        phase = 'verification'; await until(() => reachedFrameDestination(event), 'Expected embedded-frame navigation was not reached.')
        result.evidence = 'Embedded frame destination verified.'
      } else if (event.type === 'navigation') {
        if (!sameDestination(contents.getURL(), event.url)) {
          if (event.data.source === 'address' || index === 0) { await saveDispatch(); await bounded(contents.loadURL(browserURL(event.url)), 20000) }
          phase = 'verification'; await until(() => sameDestination(contents.getURL(), event.url), 'Expected navigation was not reached; the destination differs from the recording.')
        }
        result.evidence = 'Expected destination reached.'
      } else {
        await until(() => sameDestination(contents.getURL(), event.url), 'The live page does not match the recorded action URL.')
        if (event.data.optionalCookieConsent) {
          // Require consecutive absence observations, rather than an immediate missing selector.
          const absent = await page({ op: 'locate', target })
          if (!absent.found) {
            let appeared = false
            const start = Date.now()
            while (Date.now() - start < 1000) { check(); if ((await page({ op: 'locate', target })).found) { appeared = true; break } await new Promise(resolve => setTimeout(resolve, 100)) }
            if (!appeared) { result.state = 'skipped'; result.evidence = 'Optional cookie target absent for one second; no consent action performed.'; await report(status('running')); continue }
          }
        }
        await locate(event)
        if (options.demo) {
          const pointer = event.data.pointer as { relativeX?: number; relativeY?: number } | undefined
          await page({ op: 'highlight', target, offset: event.data.background && pointer ? { x: pointer.relativeX ?? .5, y: pointer.relativeY ?? .5 } : undefined })
          await demoPause(700)
          await locate(event)
        }
        result.diagnostics.precondition = 'Target uniquely resolved, visible and available.'
        if (event.data.requiresApproval && !options.authorized) {
          result.state = 'needs-user-approval'; await report(status('needs-user-approval'))
          if (!await bounded(approve(event), 300000)) throw new Error('Action was not approved. No action dispatched.')
          result.state = 'running'; await report(status('running')); await ready(); await locate(event)
        }
        if (event.type === 'input') {
          const inspect = () => page({ op: 'inspect', target })
          if (await observed(event, index)) { result.diagnostics.execution = 'not-needed' }
          else if (typeof event.data.checked === 'boolean') {
            if ((await inspect()).checked !== event.data.checked) await click(event)
            await verifyCurrent(event, index)
          } else if (Array.isArray(event.data.selectedValues)) {
            await until(async () => (await page({ op: 'checkSelect', target, values: event.data.selectedValues as string[] })).verified, 'The recorded dropdown option is unavailable.')
            await saveDispatch(); await page({ op: 'select', target, values: event.data.selectedValues as string[] })
            await verifyCurrent(event, index)
          } else {
            await page({ op: 'selectText', target }); check()
            const value = event.data.encryptedValue ? decryptInput!(event) : String(event.data.value ?? '')
            await saveDispatch()
            if (!(await page({ op: 'inspect', target })).focused) throw new ReplayFailure('EXECUTION_FAILED', 'Input focus changed before typing; no text was inserted.')
            if (value) await command('Input.insertText', { text: value })
            else await key('Backspace', 'Backspace', 8)
            await verifyCurrent(event, index)
          }
          result.evidence = 'Recorded field state verified in the live page.'
        } else if (event.type === 'scroll') {
          await saveDispatch(); await page({ op: 'scroll', target, x: Number(event.data.scrollLeft), y: Number(event.data.scrollTop) })
          try { await verifyCurrent(event, index) }
          catch (error) {
            if (!(error instanceof ReplayFailure) || error.code !== 'VERIFICATION_TIMEOUT') throw error
            result.diagnostics.recoveryAttempts++; await locate(event)
            await page({ op: 'scroll', target, x: Number(event.data.scrollLeft), y: Number(event.data.scrollTop) })
            await verifyCurrent(event, index)
          }
          result.evidence = 'Scroll offset verified.'
        } else {
          const evidence = (event.data.evidence ?? []) as PageEvidence[]
          const next = transition(index)
          const expectsNavigation = !!next
          const focusOnly = event.type === 'click' && event.data.focusOnly === true
          const downloadOffset = downloads.length
          const expectedDownloads = event.data.expectedDownloads as { filename: string; mimeType: string }[] | undefined
          if (!expectedDownloads && evidence.length && !focusOnly && !expectsNavigation && await verifyEvidence(evidence)) throw new ReplayFailure('OUTCOME_UNKNOWN', 'Expected result was already present before execution. Inspect the page; this action was not repeated.')
          if (event.type === 'click' && target.tag === 'select') { await saveDispatch(); await page({ op: 'focus', target }) }
          else if (event.type === 'click') await click(event)
          else if (event.type === 'keydown') {
            await page({ op: 'focus', target })
            const keys: Record<string, number> = { a: 65, A: 65, Enter: 13, Tab: 9, Escape: 27, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35, PageUp: 33, PageDown: 34 }
            const keyName = String(event.data.key), virtualKey = keys[keyName]; if (!virtualKey) throw new Error('Unsupported keyboard action.')
            const mods = event.data.modifiers as Record<string, boolean> | undefined
            const modifiers = (mods?.alt ? 1 : 0) | (mods?.ctrl ? 2 : 0) | (mods?.meta ? 4 : 0) | (mods?.shift ? 8 : 0)
            await saveDispatch(); await key(keyName, keyName.toLowerCase() === 'a' ? 'KeyA' : keyName, virtualKey, modifiers)
          } else throw new Error(`Unsupported execution: ${event.type}`)
          if (expectedDownloads) {
            phase = 'verification'; result.diagnostics.execution = 'dispatched'; result.diagnostics.verification = 'waiting'
            await until(async () => {
              const received = downloads.slice(downloadOffset)
              if (received.length > expectedDownloads.length) throw new Error('More downloads than expected. Inspect the files before retrying.')
              if (received.some(file => ['cancelled', 'interrupted'].includes(file.state))) throw new Error('The download did not complete.')
              if (received.length !== expectedDownloads.length || received.some(file => file.state !== 'completed')) return false
              for (const [i, file] of received.entries()) {
                const expected = expectedDownloads[i]
                if (file.filename !== expected.filename || (expected.mimeType && file.mimeType !== expected.mimeType)) throw new Error('The downloaded file differs from the recorded export.')
                const info = await stat(file.path)
                if (!info.isFile() || info.size !== file.bytes) throw new Error('Downloaded file could not be verified on disk.')
              }
              return true
            }, 'The expected download did not finish. Do not automatically repeat the export.', 60000)
          }
          else await verifyCurrent(event, index)
          result.evidence = expectedDownloads ? 'Download completed and file size, name and type verified on disk; file contents are not business-result verification.' : expectsNavigation ? 'Resulting navigation verified.' : focusOnly ? 'Editable target focus verified.' : 'Recorded observable page outcome verified (not a business-success assertion).'
        }
      }
      if (options.demo) await demoPause(400)
      result.state = 'verified'; result.diagnostics.verification = 'satisfied'; result.diagnostics.execution = dispatched ? 'dispatched' : 'not-needed'; result.diagnostics.precondition = 'satisfied'; lastVerified = index; documentToken = await token(); await report(status('running'))
    }
    await report(status('completed'))
  } catch (error) {
    let code = failureCode(error)
    // One final read-only observation handles late transitions/CDP navigation races.
    if (dispatched && current && result && !signal.aborted && !contents.isDestroyed() && !current.data.expectedDownloads && phase !== 'precondition') {
      result.diagnostics!.recoveryAttempts++
      try {
        phase = 'verification'
        await until(() => observed(current!, currentIndex), 'Recovery verification timed out.', Math.min(timeout, 2000))
        result.state = 'verified'; result.diagnostics!.verification = 'satisfied'; lastVerified = currentIndex
        result.evidence = 'Postcondition observed during bounded recovery; action was not repeated.'
        code = 'EXECUTION_FAILED' // Run is paused at a verified checkpoint; resume continues the next step.
      } catch { /* Preserve uncertainty; never repeat the action. */ }
    }
    const uncertain = dispatched && result?.state !== 'verified'
    const reason = signal.aborted ? 'Replay cancelled; a dispatched action may already have taken effect.' :
      code === 'TARGET_AMBIGUOUS' ? 'Multiple live elements match the recorded target.' :
      error instanceof ReplayFailure ? error.message : 'Browser operation failed. Inspect the live page before continuing.'
    if (result) {
      if (result.state !== 'verified') result.state = uncertain ? 'unknown' : 'failed'
      result.evidence = result.state === 'verified' ? result.evidence : reason
      if (result.diagnostics) {
        result.diagnostics.underlyingCode = code
        result.diagnostics.failureCode = signal.aborted ? 'CANCELLED' : uncertain ? 'OUTCOME_UNKNOWN' : code
        result.diagnostics.failureReason = reason
        if (phase === 'verification' && result.state !== 'verified') result.diagnostics.verification = 'timeout'
      }
    }
    if (!contents.isDestroyed()) { try { documentToken = await token() } catch {} }
    const failure = status(signal.aborted ? 'cancelled' : uncertain ? 'unknown' : 'failed', reason)
    failure.failureCode ??= code
    if (code === 'RESUME_REJECTED') { failure.resumable = false; failure.observedURL = options.resume?.observedURL; failure.documentToken = options.resume?.documentToken }
    await report(failure)
  } finally {
    if (options.demo && !contents.isDestroyed()) { try { await page({ op: 'clearHighlight' }) } catch { /* Overlays also expire automatically. */ } }
    contents.session.removeListener('will-download', onDownload)
    for (const file of downloads) if (file.state === 'progressing') file.item.cancel()
    if (attached && !contents.isDestroyed() && contents.debugger.isAttached()) {
      await Promise.race([contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: false }).catch(() => {}), new Promise(resolve => setTimeout(resolve, 1000))])
      contents.debugger.detach()
    }
  }
}
