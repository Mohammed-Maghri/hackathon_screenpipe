import { app, BrowserWindow, dialog, ipcMain, session } from 'electron'
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
