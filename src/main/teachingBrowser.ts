import { app, BrowserWindow, ipcMain, session, webFrameMain, WebContentsView, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyInputs, type SavedInput } from './replaySettings'
import { recordedURL } from '../shared/recordedURL'
import { prepareReplay } from './prepareReplay'
import { replayRecording } from './replayRecording'
import { FrameBridge } from './frameBridge'
import type { FrameIdentity } from '../shared/recording'
import { readFile, writeFile } from 'node:fs/promises'
import { RecordingStore } from './recordingStore'
import type { BrowserBounds, BrowserState } from '../shared/browser'

import { browserURL, resolveBrowserAddress } from './browserAddress'

export function registerTeachingBrowser() {
  type Entry = { frames: FrameBridge; interactedFrames: Map<number, FrameIdentity[]>; view: WebContentsView; owner: BrowserWindow; token: string; error: string | null; recording: RecordingStore; captureReady?: boolean; addressNavigation?: boolean; lastEventType?: string; approval?: { sequence: number; resolve: (approved: boolean) => void }; replay?: AbortController; popups?: Set<BrowserWindow> }
  const entries = new Map<number, Entry>()
  const recordings = new Set<RecordingStore>()
  let quitFlushed = false
  app.on('before-quit', event => {
    if (quitFlushed || !recordings.size) return
    event.preventDefault()
    void Promise.all([...recordings].map(recording => recording.stop().catch(error => console.error('Recording save failed:', error)))).then(() => { quitFlushed = true; app.quit() })
  })
  const browserSession = session.fromPartition('persist:ghost-teaching-browser')
  browserSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  browserSession.setPermissionCheckHandler(() => false)
  browserSession.on('will-download', (event, _item, contents) => { event.preventDefault(); const entry = [...entries.values()].find(item => item.view.webContents === contents); if (entry) { record(entry, 'unsupported', contents.getURL(), { reason: 'Downloads are disabled and cannot be verified.' }); entry.replay?.abort() } })
  function owner(event: IpcMainInvokeEvent | IpcMainEvent) {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window || window.webContents !== event.sender || event.senderFrame !== window.webContents.mainFrame) throw new Error('Invalid browser owner.')
    return window
  }
  function get(event: IpcMainInvokeEvent | IpcMainEvent, token: unknown) {
    const window = owner(event)
    const entry = entries.get(window.id)
    return entry?.token === token ? entry : undefined
  }
  function snapshot(entry: Entry): BrowserState {
    const contents = entry.view.webContents
    return { sessionId: entry.token, url: contents.getURL(), title: contents.getTitle(), loading: contents.isLoading(), canGoBack: contents.navigationHistory.canGoBack(), canGoForward: contents.navigationHistory.canGoForward(), error: entry.error }
  }
  function publish(entry: Entry) {
    if (!entry.owner.isDestroyed() && !entry.view.webContents.isDestroyed()) entry.owner.webContents.send('teaching:state', snapshot(entry))
  }
  function dispose(entry: Entry) {
    entry.replay?.abort()
    entry.frames.dispose()
    entry.approval?.resolve(false)
    for (const popup of entry.popups ?? []) if (!popup.isDestroyed()) popup.close()
    void entry.recording.stop().catch(error => console.error('Recording save failed:', error))
    entries.delete(entry.owner.id)
    if (!entry.owner.isDestroyed()) entry.owner.contentView.removeChildView(entry.view)
    if (!entry.view.webContents.isDestroyed()) entry.view.webContents.close({ waitForBeforeUnload: false })
  }
  function position(entry: Entry, bounds: BrowserBounds) {
    if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(value => typeof value === 'number' && Number.isFinite(value))) return
    const [width, height] = entry.owner.getContentSize()
    const x = Math.max(0, Math.min(width, Math.round(bounds.x)))
    const y = Math.max(0, Math.min(height, Math.round(bounds.y)))
    const w = Math.max(0, Math.min(width - x, Math.round(bounds.width)))
    const h = Math.max(0, Math.min(height - y, Math.round(bounds.height)))
    entry.view.setBounds({ x, y, width: w, height: h })
    entry.view.setVisible(bounds.visible === true && w > 0 && h > 0)
  }
  function load(entry: Entry, url: string) {
    entry.error = null
    entry.addressNavigation = true
    void entry.view.webContents.loadURL(url).catch(error => {
      if (entry.view.webContents.isDestroyed() || String(error).includes('ERR_ABORTED')) return
      entry.error = 'Unable to load this website. Check the address or your connection and try again.'; publish(entry)
    })
  }
  function record(entry: Entry, type: string, url: string, data: Record<string, unknown>) {
    entry.lastEventType = type
    const safe = recordedURL(url)
    if (typeof data.destination === 'string' && data.destination !== 'about:blank') { const destination = recordedURL(data.destination); data = { ...data, destination: destination.url, ...(destination.redacted ? { authenticationRequired: true } : {}) } }
    const event = entry.recording.append(type, safe.url, { ...data, ...(safe.redacted ? { authenticationRequired: true } : {}) })
    if (event && !entry.owner.isDestroyed()) entry.owner.webContents.send('recording:event', { sessionId: entry.token, event, status: entry.recording.status() })
  }
  function guest(event: IpcMainEvent) { return [...entries.values()].find(entry => entry.view.webContents === event.sender && event.senderFrame && entry.frames.accepts(event.senderFrame)) }
  ipcMain.on('recorder:ready', (event, info) => { const entry = guest(event); if (entry && event.senderFrame) {
    if (info?.sandboxed !== true) { record(entry, 'unsupported', event.sender.getURL(), { reason: 'Frame sandbox verification failed.' }); return }
    entry.frames.markReady(event.senderFrame)
    if (event.senderFrame === event.sender.mainFrame) entry.captureReady = true
    event.senderFrame.send('recorder:enabled', entry.recording.state === 'recording')
  } })
  ipcMain.on('recorder:event', (event, value: unknown) => {
    const entry = guest(event)
    if (!entry || entry.recording.state !== 'recording' || !value || typeof value !== 'object') return
    const payload = value as { type?: unknown; url?: unknown; data?: unknown }
    if (typeof payload.type !== 'string' || !['click', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup', 'drag-move', 'input', 'keydown', 'scroll', 'submit', 'page-ready', 'action-outcome', 'unsupported', 'frame-entry'].includes(payload.type) || typeof payload.url !== 'string' || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) return
    if (JSON.stringify(value).length > 64000) return
    const frame = event.senderFrame!
    const data = payload.data as Record<string, unknown>
    if (payload.type === 'frame-entry') {
      const child = data.child as { name?: string; url?: string } | undefined
      const matches = frame.frames.filter(item => child?.name ? item.name === child.name : item.url === child?.url)
      if (matches.length !== 1 || !entry.frames.isReady(matches[0]!)) record(entry, 'unsupported', event.sender.getURL(), { reason: 'The entered embedded frame is ambiguous or its recorder is unavailable. Wait for it to load and record again.' })
      return
    }
    try {
      // Passive frame readiness must not block a task that never enters that frame.
      if (payload.type === 'page-ready' && frame !== event.sender.mainFrame) return
      const framePath = entry.frames.path(frame)
      if (['click', 'input', 'keydown', 'scroll', 'submit'].includes(payload.type)) {
        for (let item = frame; item.parent; item = item.parent) entry.interactedFrames.set(item.frameTreeNodeId, entry.frames.path(item))
      }
      record(entry, payload.type, event.sender.getURL(), { ...data, frame: framePath.length ? 'subframe' : 'main', framePath })
    } catch (error) { record(entry, 'unsupported', event.sender.getURL(), { reason: error instanceof Error ? error.message : 'Unable to identify the embedded frame.' }) }
  })
  ipcMain.handle('recording:status', (event, token) => { const entry = get(event, token); if (!entry) throw new Error('Session closed.'); return entry.recording.status() })
  ipcMain.handle('recording:export', async (event, token) => { const entry = get(event, token); if (!entry) throw new Error('Session closed.'); return entry.recording.exportJSON() })
  ipcMain.handle('recording:control', async (event, token, action: unknown) => {
    const entry = get(event, token); if (!entry) throw new Error('Session closed.')
    if (!['pause', 'resume', 'stop'].includes(String(action))) throw new Error('Unknown recording action.')
    if (entry.recording.state === 'stopped') return entry.recording.status()
    if (action !== 'resume') {
      await entry.frames.flush()
    }
    entry.recording.state = action === 'resume' ? 'recording' : action === 'pause' ? 'paused' : 'stopped'
    entry.frames.setEnabled(action === 'resume')
    if (action === 'stop') return entry.recording.stop()
    await entry.recording.flush()
    return entry.recording.status()
  })
  async function replayPlan(entry: Entry) {
    if (entry.recording.state !== 'stopped') throw new Error('Stop recording before testing it.')
    const events = JSON.parse(await entry.recording.exportJSON()).events
    let inputs: SavedInput[] = []
    try { inputs = JSON.parse(await readFile(join(entry.recording.directory, 'inputs.json'), 'utf8')) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    return prepareReplay(events, inputs)
  }
  ipcMain.handle('replay:inputs', async (event, token, inputs: SavedInput[]) => {
    const entry = get(event, token); if (!entry || entry.replay) throw new Error('Session unavailable or replay running.')
    if (!Array.isArray(inputs)) throw new Error('Invalid inputs.')
    const plan = await replayPlan(entry); applyInputs(plan.steps, inputs)
    await writeFile(join(entry.recording.directory, 'inputs.json'), JSON.stringify(inputs, null, 2), { mode: 0o600 })
  })
  ipcMain.handle('replay:preview', async (event, token) => { const entry = get(event, token); if (!entry) throw new Error('Session closed.'); return (await replayPlan(entry)).preview })
  ipcMain.handle('replay:start', async (event, token) => {
    const entry = get(event, token); if (!entry) throw new Error('Session closed.')
    if (entry.replay) throw new Error('A replay is already running.')
    const controller = new AbortController(); entry.replay = controller
    try {
      const plan = await replayPlan(entry)
      if (plan.preview.blockers.length) throw new Error(plan.preview.blockers.join(' '))
      void replayRecording(entry.view.webContents, entry.owner, plan.steps, controller.signal, status => {
        if (!entry.owner.isDestroyed()) entry.owner.webContents.send('replay:status', { sessionId: entry.token, status })
        if (status.state !== 'running') void writeFile(join(entry.recording.directory, 'last-replay.json'), JSON.stringify({ ...status, finishedAt: new Date().toISOString() }, null, 2), { mode: 0o600 }).catch(error => console.error('Replay result save failed:', error))
      }, action => new Promise<boolean>(resolve => { entry.approval = { sequence: action.sequence, resolve } }), () => entry.view.getVisible(), entry.frames).finally(() => { entry.approval?.resolve(false); entry.approval = undefined; if (entry.replay === controller) entry.replay = undefined })
    } catch (error) { entry.replay = undefined; throw error }
  })
  ipcMain.handle('teaching:diagnostics', (event, token) => { const entry = get(event, token); if (!entry) throw new Error('Session closed.'); return { windowFocused: entry.owner.isFocused(), browserFocused: entry.view.webContents.isFocused(), visible: entry.view.getVisible(), captureReady: !!entry.captureReady, eventCount: entry.recording.count, lastEventType: entry.lastEventType, bounds: entry.view.getBounds() } })
  ipcMain.handle('replay:approve', (event, token, sequence, approved) => { const entry = get(event, token); if (!entry?.approval || entry.approval.sequence !== sequence || typeof approved !== 'boolean') throw new Error('No matching pending approval.'); entry.approval.resolve(approved); entry.approval = undefined })
  ipcMain.handle('replay:cancel', (event, token) => { const entry = get(event, token); entry?.replay?.abort(); entry?.approval?.resolve(false) })
  ipcMain.handle('teaching:open', (event, token: unknown, address: unknown, bounds: BrowserBounds) => {
    const window = owner(event)
    if (typeof token !== 'string' || token.length > 100 || !/#\/workflows\/[^/]+\/record\//.test(window.webContents.getURL())) throw new Error('Open a workflow teaching page first.')
    const url = browserURL(address)
    const previous = entries.get(window.id)
    if (previous) dispose(previous)
    const [, workflowId, nodeId] = window.webContents.getURL().match(/#\/workflows\/([^/]+)\/record\/([^/?#]+)/)!
    const recording = new RecordingStore(join(app.getPath('userData'), 'recordings'), decodeURIComponent(workflowId), decodeURIComponent(nodeId))
    recordings.add(recording)
    const view = new WebContentsView({ webPreferences: { preload: fileURLToPath(new URL('../preload/recorder.cjs', import.meta.url)), session: browserSession, contextIsolation: true, nodeIntegration: false, nodeIntegrationInSubFrames: true, sandbox: true, webSecurity: true } })
    const entry: Entry = { view, owner: window, token, error: null, recording, frames: new FrameBridge(view.webContents), interactedFrames: new Map() }
    entries.set(window.id, entry)
    window.contentView.addChildView(view); position(entry, bounds)
    const contents = view.webContents
    contents.setWindowOpenHandler(({ url: next }) => {
      try {
        if (next !== 'about:blank') browserURL(next)
        if (entry.replay) { entry.error = 'Replay cannot operate a separate sign-in window. Sign in before recording.'; publish(entry); return { action: 'deny' } }
        record(entry, 'popup-open', contents.getURL(), { destination: next })
        return { action: 'allow', overrideBrowserWindowOptions: { parent: window, width: 540, height: 760, autoHideMenuBar: true, webPreferences: { session: browserSession, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, preload: undefined } } }
      } catch { entry.error = 'This link is not a supported website address.'; publish(entry); return { action: 'deny' } }
    })
    contents.on('did-create-window', popup => {
      entry.popups ??= new Set(); entry.popups.add(popup)
      popup.on('closed', () => entry.popups?.delete(popup))
      popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      const validatePopup = (event: Electron.Event, next: string) => { try { if (next !== 'about:blank') browserURL(next) } catch { event.preventDefault() } }
      popup.webContents.on('will-navigate', validatePopup)
      popup.webContents.on('will-redirect', validatePopup)
    })
    const validate = (navigation: Electron.Event, next: string) => { try { browserURL(next) } catch { navigation.preventDefault() } }
    contents.on('will-navigate', validate)
    contents.on('will-redirect', validate)
    contents.on('will-attach-webview', event => event.preventDefault())
    contents.on('will-prevent-unload', event => event.preventDefault())
    contents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) entry.captureReady = false })
    contents.on('did-start-loading', () => { entry.error = null; publish(entry) })
    contents.on('did-stop-loading', () => publish(entry))
    contents.on('did-navigate', (_event, url) => { record(entry, 'navigation', url, { source: entry.addressNavigation ? 'address' : 'page' }); entry.addressNavigation = false; publish(entry) })
    const frameNavigation = (url: string, processId: number, routingId: number) => {
      const frame = webFrameMain.fromId(processId, routingId)
      if (!frame) return
      const previous = entry.interactedFrames.get(frame.frameTreeNodeId)
      if (!previous || previous.at(-1)?.url === url) return
      record(entry, 'frame-navigation', contents.getURL(), { framePath: previous, destination: url })
      try { entry.interactedFrames.set(frame.frameTreeNodeId, entry.frames.path(frame)) } catch { entry.interactedFrames.delete(frame.frameTreeNodeId) }
    }
    contents.on('did-frame-navigate', (_event, url, _code, _text, mainFrame, processId, routingId) => {
      if (mainFrame) entry.interactedFrames.clear()
      else frameNavigation(url, processId, routingId)
    })
    contents.on('did-navigate-in-page', (_event, url, mainFrame, processId, routingId) => {
      if (mainFrame) {
        record(entry, 'navigation', url, { sameDocument: true, source: entry.addressNavigation ? 'address' : 'page' })
        entry.addressNavigation = false
      } else frameNavigation(url, processId, routingId)
      publish(entry)
    })
    contents.on('page-title-updated', () => publish(entry))
    contents.on('did-fail-load', (_event, code, description, _url, mainFrame) => { if (mainFrame && code !== -3) { entry.error = `Page could not load: ${description}`; publish(entry) } })
    contents.on('render-process-gone', () => { entry.error = 'The browser page stopped responding. Reload to try again.'; publish(entry) })
    const onNavigate = () => { if (!/#\/workflows\/[^/]+\/record\//.test(window.webContents.getURL()) && entries.get(window.id) === entry) dispose(entry) }
    const onDestroy = () => { if (entries.get(window.id) === entry) dispose(entry) }
    window.webContents.on('did-navigate-in-page', onNavigate)
    window.webContents.on('did-start-navigation', onNavigate)
    window.once('closed', onDestroy)
    window.webContents.on('render-process-gone', onDestroy)
    contents.once('destroyed', () => { window.webContents.removeListener('render-process-gone', onDestroy); window.webContents.removeListener('did-navigate-in-page', onNavigate); window.webContents.removeListener('did-start-navigation', onNavigate); window.removeListener('closed', onDestroy) })
    load(entry, url)
    return snapshot(entry)
  })
  ipcMain.handle('teaching:navigate', (event, token, address) => { const entry = get(event, token); if (entry) { if (entry.replay) throw new Error('Cancel replay before navigating.'); load(entry, resolveBrowserAddress(address)) } })
  ipcMain.handle('teaching:action', (event, token, action: unknown) => {
    const entry = get(event, token); if (!entry) return
    if (entry.replay) throw new Error('Cancel replay before using browser controls.')
    const contents = entry.view.webContents
    if (['back', 'forward', 'reload'].includes(String(action))) entry.addressNavigation = true
    if (action === 'back' && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack()
    else if (action === 'forward' && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward()
    else if (action === 'reload') { entry.error = null; contents.reload() }
    else if (action === 'stop') contents.stop()
  })
  ipcMain.on('teaching:bounds', (event, token, bounds) => { try { const entry = get(event, token); if (entry) position(entry, bounds) } catch (error) { console.error('Teaching browser bounds update failed:', error) } })
  ipcMain.handle('teaching:close', (event, token) => { const entry = get(event, token); if (entry) dispose(entry) })
}
