import { app, BrowserWindow, ipcMain, session, WebContentsView, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyInputs, type SavedInput } from './replaySettings'
import { recordedURL } from '../shared/recordedURL'
import { prepareReplay } from './prepareReplay'
import { replayRecording } from './replayRecording'
import { readFile, writeFile } from 'node:fs/promises'
import { RecordingStore } from './recordingStore'
import type { BrowserBounds, BrowserState } from '../shared/browser'

import { browserURL, resolveBrowserAddress } from './browserAddress'

export function registerTeachingBrowser() {
  type Entry = { view: WebContentsView; owner: BrowserWindow; token: string; error: string | null; recording: RecordingStore; captureReady?: boolean; addressNavigation?: boolean; lastEventType?: string; approval?: { sequence: number; resolve: (approved: boolean) => void }; replay?: AbortController; popups?: Set<BrowserWindow> }
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
    if (typeof data.destination === 'string' && data.destination !== 'about:blank') data = { ...data, destination: recordedURL(data.destination).url }
    const event = entry.recording.append(type, safe.url, { ...data, ...(safe.redacted ? { authenticationRequired: true } : {}) })
    if (event && !entry.owner.isDestroyed()) entry.owner.webContents.send('recording:event', { sessionId: entry.token, event, status: entry.recording.status() })
  }
  function guest(event: IpcMainEvent) { return [...entries.values()].find(entry => entry.view.webContents === event.sender && event.senderFrame === event.sender.mainFrame) }
  ipcMain.on('recorder:ready', event => { const entry = guest(event); if (entry) { entry.captureReady = true; event.sender.send('recorder:enabled', entry.recording.state === 'recording') } })
  ipcMain.on('recorder:event', (event, value: unknown) => {
    const entry = guest(event)
    if (!entry || entry.recording.state !== 'recording' || !value || typeof value !== 'object') return
    const payload = value as { type?: unknown; url?: unknown; data?: unknown }
    if (typeof payload.type !== 'string' || !['click', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup', 'drag-move', 'input', 'keydown', 'scroll', 'submit', 'page-ready', 'action-outcome', 'unsupported'].includes(payload.type) || typeof payload.url !== 'string' || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) return
    if (JSON.stringify(value).length > 64000) return
    record(entry, payload.type, payload.url, payload.data as Record<string, unknown>)
  })
  ipcMain.handle('recording:status', (event, token) => { const entry = get(event, token); if (!entry) throw new Error('Session closed.'); return entry.recording.status() })
  ipcMain.handle('recording:export', async (event, token) => { const entry = get(event, token); if (!entry) throw new Error('Session closed.'); return entry.recording.exportJSON() })
  ipcMain.handle('recording:control', async (event, token, action: unknown) => {
    const entry = get(event, token); if (!entry) throw new Error('Session closed.')
    if (!['pause', 'resume', 'stop'].includes(String(action))) throw new Error('Unknown recording action.')
    if (entry.recording.state === 'stopped') return entry.recording.status()
    if (action !== 'resume') {
      // Flush the last debounced field edit before changing the recording state.
      await new Promise<void>((resolve, reject) => {
        const complete = () => { clearTimeout(timeout); ipcMain.removeListener('recorder:flushed', done); resolve() }
        const done = (sender: IpcMainEvent) => { if (guest(sender) === entry) complete() }
        const timeout = setTimeout(() => { ipcMain.removeListener('recorder:flushed', done); reject(new Error('Recorder did not acknowledge flush. Wait for the page to finish loading, then stop again.')) }, 2000)
        ipcMain.on('recorder:flushed', done)
        entry.view.webContents.send('recorder:flush')
      })
    }
    entry.recording.state = action === 'resume' ? 'recording' : action === 'pause' ? 'paused' : 'stopped'
    entry.view.webContents.send('recorder:enabled', action === 'resume')
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
      }, action => new Promise<boolean>(resolve => { entry.approval = { sequence: action.sequence, resolve } }), () => entry.view.getVisible()).finally(() => { entry.approval?.resolve(false); entry.approval = undefined; if (entry.replay === controller) entry.replay = undefined })
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
    const view = new WebContentsView({ webPreferences: { preload: fileURLToPath(new URL('../preload/recorder.cjs', import.meta.url)), session: browserSession, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } })
    const entry: Entry = { view, owner: window, token, error: null, recording }
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
    contents.on('did-navigate-in-page', (_event, url, mainFrame) => { if (mainFrame) record(entry, 'navigation', url, { sameDocument: true, source: entry.addressNavigation ? 'address' : 'page' }); entry.addressNavigation = false; publish(entry) })
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
