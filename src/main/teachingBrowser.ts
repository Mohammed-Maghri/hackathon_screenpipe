import { captureBrowserOutputs } from './dataProcessing/captureOutputs'
import { LoginVault } from './loginVault'
import { signInWithSavedLogin } from './savedLogin'
import type { SavedLogin } from '../shared/login'
import { app, BrowserWindow, ipcMain, safeStorage, shell, session, webFrameMain, WebContentsView, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { randomUUID } from 'node:crypto'
import { join, basename } from 'node:path'
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

import { browserURL, initialBrowserURL, resolveBrowserAddress } from './browserAddress'

const isSettingsRoute = (url: string) => /#\/settings(?:\/|\?|$)/.test(url)

export function registerTeachingBrowser() {
  type Entry = { closing?: Promise<void>; attached?: boolean; lastBounds?: BrowserBounds; authenticationPaused?: boolean; lastAction?: { id: string; at: number }; downloads?: Set<Electron.DownloadItem>; contents: Electron.WebContents; disposed?: boolean; frames: FrameBridge; interactedFrames: Map<number, FrameIdentity[]>; view: WebContentsView; owner: BrowserWindow; token: string; error: string | null; recording: RecordingStore; captureReady?: boolean; addressNavigation?: boolean; lastEventType?: string; approval?: { sequence: number; resolve: (approved: boolean) => void }; replay?: AbortController; popups?: Set<BrowserWindow> }
  const vault = new LoginVault(join(app.getPath('userData'), 'saved-logins'), { available: () => safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'), encrypt: value => safeStorage.encryptString(value), decrypt: value => safeStorage.decryptString(value) })
  const loginScope = (entry: Entry) => JSON.stringify([entry.recording.workflowId, entry.recording.nodeId])
  const entries = new Map<number, Entry>()
  const closingEntries = new Set<Entry>()
  const pendingSaves = new Set<Promise<void>>()
  const pendingOpens = new Map<number, { token: string; cancel: () => void }>()
  const modalOwners = new Map<number, Set<string>>()
  const recordings = new Set<RecordingStore>()
  let quitFlushed = false
  app.on('before-quit', event => {
    if (quitFlushed || !recordings.size) return
    event.preventDefault()
    void Promise.allSettled([...entries.values()].map(entry => dispose(entry))).then(() => Promise.allSettled([...pendingSaves])).then(() => { quitFlushed = true; app.quit() })
  })
  const browserSession = session.fromPartition('persist:ghost-teaching-browser')
  browserSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  browserSession.setPermissionCheckHandler(() => false)
  browserSession.on('will-download', (event, item, contents) => {
    const entry = [...entries.values()].find(value => value.contents === contents)
    if (!entry || entry.disposed) { event.preventDefault(); return }
    const id = randomUUID(), filename = basename(item.getFilename()).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'download'
    item.setSavePath(join(entry.recording.directory, 'downloads', id + '-' + filename))
    entry.downloads ??= new Set(); entry.downloads.add(item)
    const url = contents.getURL()
    const cause = entry.lastAction && Date.now() - entry.lastAction.at < 10000 ? entry.lastAction.id : undefined
    record(entry, 'download-start', url, { downloadId: id, causedBy: cause, filename, mimeType: item.getMimeType() })
    item.once('done', (_event, state) => {
      entry.downloads?.delete(item)
      record(entry, 'download-done', url, { downloadId: id, state, filename, bytes: item.getReceivedBytes() })
    })
  })

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
    const contents = entry.contents
    return { authenticationPaused: entry.authenticationPaused, sessionId: entry.token, url: contents.getURL(), title: contents.getTitle(), loading: contents.isLoading(), canGoBack: contents.navigationHistory.canGoBack(), canGoForward: contents.navigationHistory.canGoForward(), error: entry.error }
  }
  function publish(entry: Entry) {
    if (!entry.disposed && !entry.owner.isDestroyed() && !entry.owner.webContents.isDestroyed() && !entry.contents.isDestroyed()) entry.owner.webContents.send('teaching:state', snapshot(entry))
  }
  function dispose(entry: Entry): Promise<void> {
    if (entry.closing) return entry.closing
    if (entry.disposed) return Promise.resolve()
    entry.replay?.abort()
    entry.approval?.resolve(false)
    for (const popup of entry.popups ?? []) if (!popup.isDestroyed()) popup.close()
    // Detach immediately, but keep the recorder alive long enough to flush its last inputs.
    if (entries.get(entry.owner.id) === entry) entries.delete(entry.owner.id)
    if (!entry.owner.isDestroyed() && entry.attached) entry.owner.contentView.removeChildView(entry.view)
    entry.attached = false
    entry.view.setVisible(false)
    closingEntries.add(entry)
    const saving = (async () => {
      try {
        if (!entry.contents.isDestroyed()) {
          try { await entry.frames.flush() } catch (error) { record(entry, 'unsupported', entry.contents.getURL(), { reason: `Final input capture failed: ${String(error)}` }) }
        }
        if (entry.downloads?.size) record(entry, 'unsupported', entry.contents.getURL(), { reason: 'Recording closed before its download finished.' })
        await entry.recording.stop(true)
      } finally {
        entry.disposed = true
        closingEntries.delete(entry)
        for (const download of entry.downloads ?? []) download.cancel()
        entry.frames.dispose()
        if (!entry.contents.isDestroyed()) entry.contents.close({ waitForBeforeUnload: false })
      }
    })()
    entry.closing = saving
    pendingSaves.add(saving)
    void saving.catch(error => console.error('Recording save failed:', error)).finally(() => pendingSaves.delete(saving))
    return saving
  }
  function position(entry: Entry, bounds: BrowserBounds) {
    if (entry.closing || entry.disposed || entry.owner.isDestroyed() || entry.contents.isDestroyed()) return
    if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(value => typeof value === 'number' && Number.isFinite(value))) return
    const [width, height] = entry.owner.getContentSize()
    const x = Math.max(0, Math.min(width, Math.round(bounds.x)))
    const y = Math.max(0, Math.min(height, Math.round(bounds.y)))
    const w = Math.max(0, Math.min(width - x, Math.round(bounds.width)))
    const h = Math.max(0, Math.min(height - y, Math.round(bounds.height)))
    entry.lastBounds = bounds
    const visible = bounds.visible === true && w > 0 && h > 0 && !isSettingsRoute(entry.owner.webContents.getURL()) && !modalOwners.get(entry.owner.id)?.size
    if (!visible) entry.view.setVisible(false)
    if (!visible && entry.attached) { entry.owner.contentView.removeChildView(entry.view); entry.attached = false }
    entry.view.setBounds({ x, y, width: w, height: h })
    if (visible && !entry.attached) { entry.owner.contentView.addChildView(entry.view); entry.attached = true }
    // Reattach before showing: a detached native view may retain hidden state.
    if (visible) entry.view.setVisible(true)

  }
  function load(entry: Entry, url: string) {
    if (entry.disposed || entry.contents.isDestroyed()) return
    entry.error = null
    entry.addressNavigation = true
    void entry.contents.loadURL(url).catch(error => {
      if (entry.disposed || entry.contents.isDestroyed() || String(error).includes('ERR_ABORTED')) return
      entry.error = 'Unable to load this website. Check the address or your connection and try again.'; publish(entry)
    })
  }
  function record(entry: Entry, type: string, url: string, data: Record<string, unknown>) {
    if (entry.disposed || !url || url === 'about:blank') return // Empty setup tabs are not workflow actions.
    entry.lastEventType = type
    const safe = recordedURL(url)
    if (typeof data.destination === 'string' && data.destination !== 'about:blank') { const destination = recordedURL(data.destination); data = { ...data, destination: destination.url, ...(destination.redacted ? { authenticationRequired: true } : {}) } }
    const event = entry.recording.append(type, safe.url, { ...data, ...(safe.redacted ? { authenticationRequired: true } : {}) })
    if (event && !entry.owner.isDestroyed()) entry.owner.webContents.send('recording:event', { sessionId: entry.token, event, status: entry.recording.status() })
  }
  function guest(event: IpcMainEvent) { return [...entries.values(), ...closingEntries].find(entry => entry.contents === event.sender && event.senderFrame && entry.frames.accepts(event.senderFrame)) }
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
    if (typeof payload.type !== 'string' || !['click', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup', 'drag-move', 'input', 'keydown', 'edit-shortcut', 'scroll', 'submit', 'page-ready', 'action-outcome', 'focus-outcome', 'unsupported', 'authentication-required', 'frame-entry'].includes(payload.type) || typeof payload.url !== 'string' || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) return
    if (JSON.stringify(value).length > 64000) return
    if (payload.type === 'authentication-required') {
      record(entry, 'unsupported', event.sender.getURL(), { reason: 'Sign-in was detected. Authenticate manually, then start a new recording from the task page.' })
      entry.authenticationPaused = true
      entry.recording.state = 'paused'
      entry.frames.setEnabled(false)
      publish(entry)
      return
    }
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
      if (['click', 'keydown'].includes(payload.type) && typeof data.actionId === 'string') entry.lastAction = { id: data.actionId, at: Date.now() }
      else if (['input', 'edit-shortcut'].includes(payload.type)) entry.lastAction = undefined
      record(entry, payload.type, event.sender.getURL(), { ...data, frame: framePath.length ? 'subframe' : 'main', framePath })
    } catch (error) { record(entry, 'unsupported', event.sender.getURL(), { reason: error instanceof Error ? error.message : 'Unable to identify the embedded frame.' }) }
  })
  ipcMain.handle('login:status', (event, token) => { const entry = get(event, token); if (!entry) throw new Error('Session closed.'); return vault.summary(loginScope(entry)) })
  ipcMain.handle('login:save', async (event, token, input: SavedLogin) => { const entry = get(event, token); if (!entry || entry.replay) throw new Error('Session unavailable.'); await vault.save(loginScope(entry), input); return vault.summary(loginScope(entry)) })
  ipcMain.handle('login:remove', async (event, token) => { const entry = get(event, token); if (!entry || entry.replay) throw new Error('Session unavailable.'); await vault.remove(loginScope(entry)) })
  ipcMain.handle('login:run', async (event, token) => {
    const entry = get(event, token); if (!entry || entry.replay) throw new Error('Session unavailable.')
    const login = await vault.get(loginScope(entry)); if (!login) throw new Error('Save login details first.')
    const controller = new AbortController(); entry.replay = controller
    entry.recording.state = entry.recording.state === 'stopped' ? 'stopped' : 'paused'; entry.frames.setEnabled(false)
    try { await signInWithSavedLogin(entry.contents, entry.owner, login, controller.signal); return { ok: true } }
    finally { if (entry.replay === controller) entry.replay = undefined; publish(entry) }
  })
  ipcMain.handle('recording:learned', async (event, workflowId: unknown, nodeIds: unknown) => {
    owner(event)
    if (typeof workflowId !== 'string' || !Array.isArray(nodeIds) || nodeIds.length > 500 || nodeIds.some(id => typeof id !== 'string')) throw new Error('Invalid workflow steps.')
    await Promise.all([...pendingSaves])
    return Promise.all(nodeIds.map(async nodeId => {
      const saved = await RecordingStore.restore(join(app.getPath('userData'), 'recordings'), workflowId, nodeId)
      if (!saved) return { nodeId, status: 'Needs teaching' }
      let learned = false
      try {
        const replay = JSON.parse(await readFile(join(saved.directory, 'last-replay.json'), 'utf8'))
        const exported = JSON.parse(await saved.exportJSON())
        const plan = prepareReplay(exported.events, exported.inputs)
        learned = replay.recordingId === saved.id && replay.planHash === saved.planHash(plan.steps) && !plan.preview.blockers.length && replay.state === 'completed' && replay.total > 0 && replay.completed === replay.total
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      return { nodeId, status: learned ? 'Learned' : 'Recorded' }
    }))
  })
  ipcMain.handle('recording:status', (event, token) => { const entry = get(event, token); if (!entry) throw new Error('Session closed.'); return entry.recording.status() })
  ipcMain.handle('recording:sync-secrets', (event, token) => { const entry = get(event, token); if (!entry) throw new Error('Session closed.'); return entry.recording.syncSecrets() })
  ipcMain.handle('recording:export', async (event, token) => { const entry = get(event, token); if (!entry) throw new Error('Session closed.'); return entry.recording.exportJSON() })
  ipcMain.handle('recording:control', async (event, token, action: unknown) => {
    const entry = get(event, token); if (!entry) throw new Error('Session closed.')
    if (!['pause', 'resume', 'stop'].includes(String(action))) throw new Error('Unknown recording action.')
    if (entry.recording.state === 'stopped') return action === 'stop' ? entry.recording.stop(true) : entry.recording.status()
    if (action === 'resume' && entry.authenticationPaused) throw new Error('Finish signing in, then choose Start task recording to create a clean recording.')
    if (action !== 'resume' && entry.downloads?.size) throw new Error('A download is still running. Wait for it to finish before pausing or stopping.')
    if (action !== 'resume') {
      await entry.frames.flush()
    }
    entry.recording.state = action === 'resume' ? 'recording' : action === 'pause' ? 'paused' : 'stopped'
    entry.frames.setEnabled(action === 'resume')
    if (action === 'stop') return entry.recording.stop(true)
    await entry.recording.flush()
    return entry.recording.status()
  })
  async function replayPlan(entry: Entry) {
    if (entry.recording.state !== 'stopped') throw new Error('Stop recording before testing it.')
    const { events, inputs, inputSource } = await entry.recording.replayData()
    const plan = prepareReplay(events, inputs)
    return { ...plan, preview: { ...plan.preview, inputSource } }
  }
  ipcMain.handle('replay:inputs', async (event, token, inputs: SavedInput[]) => {
    const entry = get(event, token); if (!entry || entry.replay) throw new Error('Session unavailable or replay running.')
    if (!Array.isArray(inputs)) throw new Error('Invalid inputs.')
    const plan = await replayPlan(entry)
    const fields = new Map(plan.preview.inputs.map(input => [input.sequence, input]))
    // Renderer sends replacements only. Determine secrecy from the recording,
    // never from client flags, and encrypt before touching the filesystem.
    inputs = inputs.map(input => {
      if (!fields.has(input.sequence) || typeof input.value !== 'string' || input.value.length > 10000) throw new Error('Invalid saved input.')
      const action = plan.steps.find(step => step.sequence === input.sequence)!
      if (fields.get(input.sequence)!.secret) {
        const encryptedValue = input.value ? entry.recording.encryptInput(action, input.value) : action.data.encryptedValue
        return { sequence: input.sequence, label: fields.get(input.sequence)!.label, value: '', secret: true, ...(encryptedValue ? { encryptedValue } : {}) }
      }
      return { sequence: input.sequence, label: fields.get(input.sequence)!.label, value: input.value }
    })
    applyInputs(plan.steps, inputs)
    await writeFile(join(entry.recording.directory, 'inputs.json'), JSON.stringify(inputs, null, 2), { mode: 0o600 })
    await entry.recording.syncSecrets()
  })
  ipcMain.handle('replay:artifact', async (event, token, runId: string, artifactId: string, action: string) => {
    const entry = get(event, token); if (!entry) throw new Error('Session closed.')
    if (action === 'preview') return entry.recording.artifactPreview(runId, artifactId)
    if (action !== 'reveal') throw new Error('Invalid file action.')
    const file = await entry.recording.runArtifact(runId, artifactId)
    shell.showItemInFolder(file.path)
    return ''
  })
  ipcMain.handle('replay:folder', async (event, token) => {
    const entry = get(event, token); if (!entry) throw new Error('Session closed.')
    const error = await shell.openPath(entry.recording.directory)
    if (error) throw new Error(error)
  })
  ipcMain.handle('replay:preview', async (event, token) => { const entry = get(event, token); if (!entry) throw new Error('Session closed.'); return (await replayPlan(entry)).preview })
  ipcMain.handle('replay:start', async (event, token, authorizeRecordedActions = false, resume = false, mode = 'fast') => {
    const entry = get(event, token); if (!entry) throw new Error('Session closed.')
    if (entry.replay) throw new Error('A replay is already running.')
    const controller = new AbortController(); entry.replay = controller
    try {
      const plan = await replayPlan(entry)
      const planHash = entry.recording.planHash(plan.steps)
      if (plan.preview.blockers.length) {
        const status = { state: 'failed' as const, completed: 0, total: plan.steps.length, sequence: null, action: 'Planning', error: plan.preview.blockers.join(' '), failureCode: 'ACTION_UNSUPPORTED' as const, resumable: false, currentActionIndex: 0, lastVerifiedCheckpoint: -1 }
        await entry.recording.saveReplay(status, planHash)
        if (!entry.owner.isDestroyed()) entry.owner.webContents.send('replay:status', { sessionId: entry.token, status })
        throw new Error(status.error)
      }
      const checkpoint = resume === true ? await entry.recording.loadReplay(planHash) : undefined
      const runId = checkpoint?.runId ?? randomUUID(), startedAt = checkpoint?.startedAt ?? new Date().toISOString()
      void replayRecording(entry.contents, entry.owner, plan.steps, controller.signal, async status => {
        status = { ...status, runId, startedAt, ...(['completed', 'failed', 'unknown', 'cancelled'].includes(status.state) ? { finishedAt: new Date().toISOString() } : {}) }
        if (status.state === 'completed') {
          try { status = { ...status, structuredOutputs: await captureBrowserOutputs(entry.contents, entry.recording.workflowId, entry.recording.nodeId) } }
          catch (error) { status = { ...status, state: 'failed', error: error instanceof Error ? error.message : 'Output capture failed.' } }
        }
        await entry.recording.saveReplay(status, planHash)
        if (!entry.owner.isDestroyed()) entry.owner.webContents.send('replay:status', { sessionId: entry.token, status: { ...status, recordingId: entry.recording.id, workflowId: entry.recording.workflowId } })

      }, action => authorizeRecordedActions === true ? Promise.resolve(true) : new Promise<boolean>(resolve => { entry.approval = { sequence: action.sequence, resolve } }), () => entry.view.getVisible(), entry.frames, async targetURL => {
        if (plan.steps.some(step => step.data.encryptedValue)) return
        const login = await vault.get(loginScope(entry))
        if (!login) return
        if (new URL(targetURL).origin !== new URL(login.loginURL).origin) throw new Error('Saved login belongs to a different website. Update Login settings.')
        await signInWithSavedLogin(entry.contents, entry.owner, login, controller.signal)
      }, event => entry.recording.decryptInput(event), { resume: checkpoint, authorized: authorizeRecordedActions === true, demo: mode === 'demo' }).catch(() => { entry.error = 'Unable to persist replay checkpoint. Replay stopped.'; publish(entry) }).finally(() => { entry.approval?.resolve(false); entry.approval = undefined; if (entry.replay === controller) entry.replay = undefined })
    } catch (error) { entry.replay = undefined; throw error }
  })
  ipcMain.handle('teaching:diagnostics', (event, token) => { const entry = get(event, token); if (!entry) throw new Error('Session closed.'); return { windowFocused: entry.owner.isFocused(), browserFocused: entry.contents.isFocused(), visible: entry.view.getVisible(), captureReady: !!entry.captureReady, eventCount: entry.recording.count, lastEventType: entry.lastEventType, bounds: entry.view.getBounds() } })
  ipcMain.handle('replay:approve', (event, token, sequence, approved) => { const entry = get(event, token); if (!entry?.approval || entry.approval.sequence !== sequence || typeof approved !== 'boolean') throw new Error('No matching pending approval.'); entry.approval.resolve(approved); entry.approval = undefined })
  ipcMain.handle('replay:cancel', (event, token) => { const entry = get(event, token); entry?.replay?.abort(); entry?.approval?.resolve(false) })
  ipcMain.handle('teaching:open', async (event, token: unknown, address: unknown, bounds: BrowserBounds, fresh = false) => {
    const window = owner(event)
    if (typeof token !== 'string' || token.length > 100 || !/#\/workflows\/[^/]+\/record\//.test(window.webContents.getURL())) throw new Error('Open a workflow teaching page first.')
    let url = initialBrowserURL(address)
    const previous = entries.get(window.id)
    if (previous) dispose(previous)
    const [, workflowId, nodeId] = window.webContents.getURL().match(/#\/workflows\/([^/]+)\/record\/([^/?#]+)/)!
    const root = join(app.getPath('userData'), 'recordings')
    // Closing or replacing a route must also cancel startup before a native view exists.
    pendingOpens.get(window.id)?.cancel()
    const ownerContents = window.webContents
    const ownerURL = ownerContents.getURL()
    // Settings is an occluding route over the mounted teaching page. Keep both
    // a pending open and its native session alive while that page is covered.
    const isSessionLocation = (nextURL: string) => nextURL === ownerURL || (nextURL.split('#')[0] === ownerURL.split('#')[0] && isSettingsRoute(nextURL))
    let cancelled = false
    const request = { token, cancel: () => { cancelled = true } }
    pendingOpens.set(window.id, request)
    const cancelNavigation = (_event: Electron.Event, nextURL: string, _inPlace: boolean, mainFrame: boolean) => {
      if (mainFrame && !isSessionLocation(nextURL)) request.cancel()
    }
    const cancelInPage = (_event: Electron.Event, nextURL: string, mainFrame: boolean) => cancelNavigation(_event, nextURL, true, mainFrame)
    ownerContents.on('did-start-navigation', cancelNavigation)
    ownerContents.on('did-navigate-in-page', cancelInPage)
    ownerContents.once('render-process-gone', request.cancel)
    window.once('closed', request.cancel)
    let recording: RecordingStore
    try {
      await Promise.all([...pendingSaves])
      const restored = fresh === true ? null : await RecordingStore.restore(root, decodeURIComponent(workflowId), decodeURIComponent(nodeId))
      // The node's configured URL controls opening the browser. Replay retains
      // its own recorded start URL; restoring a recording must not override edits.
      if (cancelled || window.isDestroyed() || ownerContents.isDestroyed() || !isSessionLocation(ownerContents.getURL())) throw new Error('Teaching session closed.')
      recording = restored ?? new RecordingStore(root, decodeURIComponent(workflowId), decodeURIComponent(nodeId))
    } finally {
      if (pendingOpens.get(window.id) === request) pendingOpens.delete(window.id)
      ownerContents.removeListener('did-start-navigation', cancelNavigation)
      ownerContents.removeListener('did-navigate-in-page', cancelInPage)
      ownerContents.removeListener('render-process-gone', request.cancel)
      window.removeListener('closed', request.cancel)
    }
    recordings.add(recording)
    const view = new WebContentsView({ webPreferences: { preload: fileURLToPath(new URL('../preload/recorder.cjs', import.meta.url)), session: browserSession, contextIsolation: true, nodeIntegration: false, nodeIntegrationInSubFrames: true, sandbox: true, webSecurity: true } })
    const entry: Entry = { contents: view.webContents, view, owner: window, token, error: null, recording, frames: new FrameBridge(view.webContents), interactedFrames: new Map() }
    entries.set(window.id, entry)
    window.contentView.addChildView(view); entry.attached = true; position(entry, bounds)
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
    const onNavigate = () => {
      if (entries.get(window.id) !== entry) return
      if (!isSessionLocation(window.webContents.getURL())) void dispose(entry)
      else if (entry.lastBounds) position(entry, entry.lastBounds)
    }
    const onDestroy = () => { if (entries.get(window.id) === entry) dispose(entry) }
    window.webContents.on('did-navigate-in-page', onNavigate)
    window.webContents.on('did-start-navigation', onNavigate)
    window.once('closed', onDestroy)
    window.webContents.on('render-process-gone', onDestroy)
    contents.once('destroyed', () => { ownerContents.removeListener('render-process-gone', onDestroy); ownerContents.removeListener('did-navigate-in-page', onNavigate); ownerContents.removeListener('did-start-navigation', onNavigate); window.removeListener('closed', onDestroy) })
    load(entry, url)
    return snapshot(entry)
  })
  ipcMain.handle('teaching:navigate', (event, token, address) => { const entry = get(event, token); if (entry) { if (entry.replay) throw new Error('Cancel replay before navigating.'); load(entry, resolveBrowserAddress(address)) } })
  ipcMain.handle('teaching:action', (event, token, action: unknown) => {
    const entry = get(event, token); if (!entry) return
    if (entry.replay) throw new Error('Cancel replay before using browser controls.')
    const contents = entry.contents
    if (['back', 'forward', 'reload'].includes(String(action))) entry.addressNavigation = true
    if (action === 'back' && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack()
    else if (action === 'forward' && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward()
    else if (action === 'reload') { entry.error = null; contents.reload() }
    else if (action === 'stop') contents.stop()
  })
  ipcMain.handle('teaching:modal', (event, id: unknown, open: unknown) => {
    const window = owner(event)
    if (typeof id !== 'string' || id.length > 100 || typeof open !== 'boolean') throw new Error('Invalid modal state.')
    let active = modalOwners.get(window.id)
    if (!active) {
      active = new Set(); modalOwners.set(window.id, active)
      window.once('closed', () => modalOwners.delete(window.id))
      window.webContents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) active!.clear() })
      window.webContents.on('render-process-gone', () => active!.clear())
    }
    if (open) active.add(id); else active.delete(id)
    const entry = entries.get(window.id)
    if (entry?.lastBounds) position(entry, entry.lastBounds)
  })
  ipcMain.on('teaching:bounds', (event, token, bounds) => { try { const entry = get(event, token); if (entry) position(entry, bounds) } catch (error) { console.error('Teaching browser bounds update failed:', error) } })
  ipcMain.handle('teaching:close', (event, token) => {
    const pending = pendingOpens.get(owner(event).id)
    if (pending && pending.token === token) pending.cancel()
    const entry = get(event, token); if (entry) return dispose(entry)
  })
}
