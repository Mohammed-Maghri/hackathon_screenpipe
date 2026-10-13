import { contextBridge, ipcRenderer } from 'electron'
import type { RecordedEvent, RecordingStatus, ReplayStatus, ReplayPreview } from '../shared/recording'
import type { BrowserBounds, BrowserAction, BrowserState } from '../shared/browser'
contextBridge.exposeInMainWorld('ghost', {
  platform: process.platform,
  listWorkflows: (offset: number = 0) => ipcRenderer.invoke('workflows:list', offset),
  getWorkflow: (id: string) => ipcRenderer.invoke('workflows:get', id),
  prepareDiscovery: (input: import('../shared/discovery').DiscoveryRequest) => ipcRenderer.invoke('discovery:prepare', input),
  browser: {
    open: (token: string, url: string, bounds: BrowserBounds) => ipcRenderer.invoke('teaching:open', token, url, bounds),
    navigate: (token: string, url: string) => ipcRenderer.invoke('teaching:navigate', token, url),
    action: (token: string, action: BrowserAction) => ipcRenderer.invoke('teaching:action', token, action),
    bounds: (token: string, bounds: BrowserBounds) => ipcRenderer.send('teaching:bounds', token, bounds),
    close: (token: string) => ipcRenderer.invoke('teaching:close', token),
    recordingControl: (token: string, action: 'pause' | 'resume' | 'stop') => ipcRenderer.invoke('recording:control', token, action),
    recordingStatus: (token: string) => ipcRenderer.invoke('recording:status', token),
    recordingExport: (token: string) => ipcRenderer.invoke('recording:export', token),
    replaySaveInputs: (token: string, inputs: ReplayPreview['inputs']) => ipcRenderer.invoke('replay:inputs', token, inputs),
    replayPreview: (token: string) => ipcRenderer.invoke('replay:preview', token),
    replayStart: (token: string) => ipcRenderer.invoke('replay:start', token),
    diagnostics: (token: string) => ipcRenderer.invoke('teaching:diagnostics', token),
    replayApprove: (token: string, sequence: number, approved: boolean) => ipcRenderer.invoke('replay:approve', token, sequence, approved),
    replayCancel: (token: string) => ipcRenderer.invoke('replay:cancel', token),
    onReplay: (listener: (value: { sessionId: string; status: ReplayStatus }) => void) => {
      const receive = (_event: Electron.IpcRendererEvent, value: { sessionId: string; status: ReplayStatus }) => listener(value)
      ipcRenderer.on('replay:status', receive)
      return () => ipcRenderer.removeListener('replay:status', receive)
    },
    onRecorded: (listener: (value: { sessionId: string; event: RecordedEvent; status: RecordingStatus }) => void) => {
      const receive = (_event: Electron.IpcRendererEvent, value: { sessionId: string; event: RecordedEvent; status: RecordingStatus }) => listener(value)
      ipcRenderer.on('recording:event', receive)
      return () => ipcRenderer.removeListener('recording:event', receive)
    },
    onState: (listener: (state: BrowserState) => void) => {
      const receive = (_event: Electron.IpcRendererEvent, state: BrowserState) => listener(state)
      ipcRenderer.on('teaching:state', receive)
      return () => ipcRenderer.removeListener('teaching:state', receive)
    },
  },
  controlWindow: (action: 'minimize' | 'maximize' | 'close') => {
    if (['minimize', 'maximize', 'close'].includes(action)) ipcRenderer.send('window:control', action)
  },
})
