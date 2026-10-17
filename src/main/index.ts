import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { discoverScreenpipeAgentWorkflow } from './screenpipeAgentDiscovery'
import { WorkflowScheduler } from './workflowScheduler'
import { graphSchema } from '../shared/dataProcessing'
import { RuntimeLogicService } from './dataProcessing/runtimeLogic'
import { LocalProcessingService } from './dataProcessing/service'
import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { deleteSavedWorkflow, prepareWorkflowDiscovery, listSavedWorkflows, getSavedWorkflow, mutateWorkflowBackend, mockWorkflowActivity } from './discoveryBackend'
import { registerTeachingBrowser } from './teachingBrowser'
import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Configure before ready: Linux Wayland/Vulkan drivers can leave the compositor black.
// Opt back into acceleration explicitly for graphics-heavy websites.
const softwareRendering = process.env.GHOST_SOFTWARE_RENDERING === '1' || (process.platform === 'linux' && process.env.GHOST_SOFTWARE_RENDERING !== '0')
if (softwareRendering) app.disableHardwareAcceleration()
function logFailure(kind: string, details: unknown) {
  console.error(`[Ghost ${kind}]`, details)
  const directory = join(app.getPath('userData'), 'logs')
  void mkdir(directory, { recursive: true }).then(() => appendFile(join(directory, 'process-errors.jsonl'), JSON.stringify({ timestamp: new Date().toISOString(), kind, details, softwareRendering }) + '\n', { mode: 0o600 })).catch(error => console.error('Unable to write diagnostics:', error))
}
app.on('child-process-gone', (_event, details) => logFailure('child-process-gone', details))
app.on('render-process-gone', (_event, _contents, details) => logFailure('render-process-gone', details))

if (existsSync('.env')) loadEnvFile('.env')
const here = fileURLToPath(new URL('.', import.meta.url))
const devURL = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 760, minHeight: 620,
    title: 'Ghost', backgroundColor: '#080808', show: false,
    frame: false, titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 25, y: 22 },
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  })
  window.once('ready-to-show', () => window.show())
  // Some Wayland compositors do not paint a hidden software-rendered window,
  // so ready-to-show never fires even though the renderer finished loading.
  // Showing after the first load breaks that circular dependency.
  window.webContents.once('did-finish-load', () => {
    if (!window.isDestroyed() && !window.isVisible()) window.show()
  })
  let recovering = false
  window.webContents.on('render-process-gone', (_event, details) => {
    if (recovering || window.isDestroyed() || details.reason === 'clean-exit') return
    recovering = true
    // A native dialog remains usable even when the app renderer has died.
    void dialog.showMessageBox(window, {
      type: 'error', title: 'Ghost stopped displaying',
      message: 'The app display process stopped.',
      detail: `Reason: ${details.reason}. Recordings already written to disk remain saved. Reloading resets unsaved editor changes. Diagnostic details are in ${join(app.getPath('userData'), 'logs')}.`,
      buttons: ['Reload Ghost', 'Close'], defaultId: 0, cancelId: 1,
    }).then(({ response }) => {
      if (window.isDestroyed()) return
      if (response === 0) window.webContents.reload()
      else window.close()
    }).finally(() => { recovering = false })
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())
  if (devURL) void window.loadURL(devURL)
  else void window.loadFile(join(here, '../renderer/index.html'))
}

app.whenReady().then(() => {
  registerTeachingBrowser()
  function authorizeBackend(event: Electron.IpcMainInvokeEvent) {
    const window = BrowserWindow.fromWebContents(event.sender)
    const trustedURL = new URL(devURL || '../renderer/index.html', import.meta.url).href
    if (!window || event.senderFrame !== window.webContents.mainFrame || event.sender.getURL().split('#')[0] !== trustedURL.split('#')[0]) {
      throw new Error('Unauthorized backend request')
    }
  }
  const processing = new LocalProcessingService(app.getPath('userData'))
  const runtimeLogic = new RuntimeLogicService(app.getPath('userData'), processing)
  const scheduler = new WorkflowScheduler(app.getPath('userData'), async id => {
    const loaded = await getSavedWorkflow(id)
    if (!loaded.ok) throw new Error(loaded.error)
    if (loaded.workflow.status === 'ARCHIVED') throw new Error('Unarchive this workflow before running it.')
    const graph = graphSchema.parse(loaded.workflow)
    if (!graph.nodes.some(n => n.config.stepType === 'data_processing')) throw new Error('This workflow has no processing nodes. Open the canvas to run its browser recording.')
    if (graph.nodes.some(n => !['browser', 'data_processing'].includes(n.config.stepType ?? ''))) throw new Error('This workflow contains nodes that the local processing runner cannot execute.')
    const results = await processing.run({ workflowId: id, graph })
    const failed = results.find(result => result.status !== 'VERIFIED')
    if (failed) throw new Error(failed.error ?? 'Processing failed.')
  })
  const schedulerReady = scheduler.load()
  void schedulerReady.catch(error => logFailure('scheduler', error.message))
  let ticking = false
  setInterval(() => { if (ticking) return; ticking = true; void schedulerReady.then(() => scheduler.tick()).catch(error => logFailure('scheduler', error.message)).finally(() => { ticking = false }) }, 15000).unref()
  ipcMain.handle('automation:list', async event => { authorizeBackend(event); await schedulerReady; return scheduler.list() })
  ipcMain.handle('automation:save', async (event, input) => { authorizeBackend(event); await schedulerReady; return scheduler.save(input) })
  ipcMain.handle('automation:remove', async (event, id) => { authorizeBackend(event); await schedulerReady; return scheduler.remove(id) })
  ipcMain.handle('automation:run', async (event, id) => { authorizeBackend(event); await schedulerReady; return scheduler.run(id) })
  ipcMain.handle('logic:inspect', (event, workflowId, nodeId) => { authorizeBackend(event); return runtimeLogic.inspect(workflowId, nodeId) })
  ipcMain.handle('logic:generate', (event, id, samples, consent) => { authorizeBackend(event); return runtimeLogic.generate(id, samples, consent) })
  ipcMain.handle('logic:test', (event, id, plan) => { authorizeBackend(event); return runtimeLogic.test(id, plan) })
  ipcMain.handle('logic:approve', (event, id, testId) => { authorizeBackend(event); return runtimeLogic.approve(id, testId) })
  ipcMain.handle('logic:reveal', async (event, id, fileId) => { authorizeBackend(event); shell.showItemInFolder(await runtimeLogic.reveal(id, fileId)) })
  ipcMain.handle('processing:run', (event, input) => { authorizeBackend(event); return processing.run(input, status => { if (!event.sender.isDestroyed()) event.sender.send('processing:status', status) }) })
  ipcMain.handle('processing:reveal', async (event, workflowId, fileId) => { authorizeBackend(event); if (typeof workflowId !== 'string' || typeof fileId !== 'string') throw new Error('Invalid artifact reference'); shell.showItemInFolder(await processing.path(workflowId, fileId)) })
  ipcMain.handle('discovery:screenpipe', (event, input) => { authorizeBackend(event); return discoverScreenpipeAgentWorkflow(input, { stateDir: join(app.getPath('userData'), 'screenpipe-discovery'), notify: progress => { if (!event.sender.isDestroyed()) event.sender.send('discovery:progress', progress) } }) })
  ipcMain.handle('discovery:prepare', (event, input) => { authorizeBackend(event); return prepareWorkflowDiscovery(input) })
  ipcMain.handle('discovery:mock', (event, input) => { authorizeBackend(event); return mockWorkflowActivity(input) })
  ipcMain.handle('discovery:generate', (event, input) => { authorizeBackend(event); return mutateWorkflowBackend('/api/workflow-discovery/generate', input) })
  ipcMain.handle('workflows:contracts', (event, id) => { authorizeBackend(event); if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid workflow ID'); return mutateWorkflowBackend(`/api/workflows/${id}/contracts`, {}) })
  ipcMain.handle('workflows:update', (event, id, input) => {
    authorizeBackend(event)
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid workflow ID')
    return mutateWorkflowBackend(`/api/workflows/${id}`, input, 'PATCH')
  })
  ipcMain.handle('workflows:list', (event, offset, options) => { authorizeBackend(event); return listSavedWorkflows(offset, options) })
  ipcMain.handle('workflows:create', (event, input) => { authorizeBackend(event); return mutateWorkflowBackend('/api/workflows', input) })
  ipcMain.handle('workflows:delete', async (event, id) => { authorizeBackend(event); await schedulerReady; await scheduler.remove(id); return deleteSavedWorkflow(id) })
  ipcMain.handle('workflows:get', (event, id) => { authorizeBackend(event); return getSavedWorkflow(id) })
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  ipcMain.on('window:control', (event, action: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window || event.senderFrame !== window.webContents.mainFrame) return
    if (action === 'minimize') window.minimize()
    if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize()
    if (action === 'close') window.close()
  })
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
