import { contextBridge, ipcRenderer } from 'electron'
import type { RecordedEvent, RecordingStatus, ReplayStatus, ReplayPreview } from '../shared/recording'
import type { BrowserBounds, BrowserAction, BrowserState } from '../shared/browser'
contextBridge.exposeInMainWorld('ghost', {
  platform: process.platform,
  setAppearance: (theme: 'light' | 'dark') => ipcRenderer.invoke('appearance:set', theme),
  automation: {
    list: () => ipcRenderer.invoke('automation:list'),
    save: (input: import('../shared/workflowSchedule').WorkflowSchedule) => ipcRenderer.invoke('automation:save', input),
    remove: (id: string) => ipcRenderer.invoke('automation:remove', id),
    run: (id: string) => ipcRenderer.invoke('automation:run', id),
  },
  runtimeLogic: {
    inspect: (workflowId: string, nodeId: string) => ipcRenderer.invoke('logic:inspect', workflowId, nodeId),
    generate: (id: string, samples: boolean, consent: boolean) => ipcRenderer.invoke('logic:generate', id, samples, consent),
    test: (id: string, plan: import('../shared/processingPlan').ProcessingPlan) => ipcRenderer.invoke('logic:test', id, plan),
    approve: (id: string, testId: string) => ipcRenderer.invoke('logic:approve', id, testId),
    reveal: (id: string, fileId: string) => ipcRenderer.invoke('logic:reveal', id, fileId),
  },
  processing: {
    onStatus: (listener: (event: import('../shared/dataProcessing').ProcessingEvent) => void) => {
      const receive = (_event: Electron.IpcRendererEvent, status: import('../shared/dataProcessing').ProcessingEvent) => listener(status)
      ipcRenderer.on('processing:status', receive)
      return () => ipcRenderer.removeListener('processing:status', receive)
    },
    run: (input: import('../shared/dataProcessing').ProcessingRequest) => ipcRenderer.invoke('processing:run', input),
    reveal: (workflowId: string, fileId: string) => ipcRenderer.invoke('processing:reveal', workflowId, fileId),
  },
  activityTimeline: (range: import('../shared/activityTimeline').ActivityRange) => ipcRenderer.invoke('screenpipe:activity', range),
  discoverWorkflow: (input: import('../shared/discovery').GenerateWorkflowRequest) => ipcRenderer.invoke('discovery:screenpipe', input),
  onDiscoveryProgress: (listener: (progress: import('../shared/discovery').DiscoveryProgress) => void) => {
    const receive = (_event: Electron.IpcRendererEvent, progress: import('../shared/discovery').DiscoveryProgress) => listener(progress)
    ipcRenderer.on('discovery:progress', receive)
    return () => ipcRenderer.removeListener('discovery:progress', receive)
  },
  mockDiscovery: (input: import('../shared/discovery').DiscoveryRequest) => ipcRenderer.invoke('discovery:mock', input),
  generateWorkflow: (input: import('../shared/discovery').GenerateWorkflowRequest) => ipcRenderer.invoke('discovery:generate', input),
  defineWorkflowContracts: (id: string) => ipcRenderer.invoke('workflows:contracts', id),
  updateWorkflow: (id: string, input: import('../shared/discovery').WorkflowUpdate) => ipcRenderer.invoke('workflows:update', id, input),
  listWorkflows: (offset: number = 0, options?: import('../shared/discovery').WorkflowListOptions) => ipcRenderer.invoke('workflows:list', offset, options),
  createWorkflow: (input: import('../shared/discovery').WorkflowCreate) => ipcRenderer.invoke('workflows:create', input),
  deleteWorkflow: (id: string) => ipcRenderer.invoke('workflows:delete', id),
  getWorkflow: (id: string) => ipcRenderer.invoke('workflows:get', id),
  prepareDiscovery: (input: import('../shared/discovery').DiscoveryRequest) => ipcRenderer.invoke('discovery:prepare', input),
  browser: {
    loginStatus: (token: string) => ipcRenderer.invoke('login:status', token),
    loginSave: (token: string, input: import('../shared/login').SavedLogin) => ipcRenderer.invoke('login:save', token, input),
    loginRemove: (token: string) => ipcRenderer.invoke('login:remove', token),
    loginRun: (token: string) => ipcRenderer.invoke('login:run', token),
    modal: (id: string, open: boolean) => ipcRenderer.invoke('teaching:modal', id, open),
    open: (token: string, url: string, bounds: BrowserBounds, fresh?: boolean) => ipcRenderer.invoke('teaching:open', token, url, bounds, fresh),
    navigate: (token: string, url: string) => ipcRenderer.invoke('teaching:navigate', token, url),
    action: (token: string, action: BrowserAction) => ipcRenderer.invoke('teaching:action', token, action),
    bounds: (token: string, bounds: BrowserBounds) => ipcRenderer.send('teaching:bounds', token, bounds),
    close: (token: string) => ipcRenderer.invoke('teaching:close', token),
    recordingControl: (token: string, action: 'pause' | 'resume' | 'stop') => ipcRenderer.invoke('recording:control', token, action),
    learnedSteps: (workflowId: string, nodeIds: string[]) => ipcRenderer.invoke('recording:learned', workflowId, nodeIds),
    syncSecrets: (token: string) => ipcRenderer.invoke('recording:sync-secrets', token),
    recordingStatus: (token: string) => ipcRenderer.invoke('recording:status', token),
    recordingExport: (token: string) => ipcRenderer.invoke('recording:export', token),
    replayArtifact: (token: string, runId: string, artifactId: string, action: 'preview' | 'reveal') => ipcRenderer.invoke('replay:artifact', token, runId, artifactId, action),
    replayFolder: (token: string) => ipcRenderer.invoke('replay:folder', token),
    replaySaveInputs: (token: string, inputs: ReplayPreview['inputs']) => ipcRenderer.invoke('replay:inputs', token, inputs),
    replayPreview: (token: string) => ipcRenderer.invoke('replay:preview', token),
    replayStart: (token: string, authorizeRecordedActions?: boolean, resume?: boolean, mode?: 'fast' | 'demo') => ipcRenderer.invoke('replay:start', token, authorizeRecordedActions, resume, mode),
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
