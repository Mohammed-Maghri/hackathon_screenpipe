import type { RecordedEvent, RecordingStatus, ReplayPreview, ReplayStatus } from './recording'
export interface BrowserBounds { x: number; y: number; width: number; height: number; visible: boolean }
export interface BrowserState { authenticationPaused?: boolean; sessionId: string; url: string; title: string; loading: boolean; canGoBack: boolean; canGoForward: boolean; error: string | null }
export type BrowserAction = 'back' | 'forward' | 'reload' | 'stop'
export interface TeachingBrowser {
  modal: (id: string, open: boolean) => Promise<void>
  loginStatus: (sessionId: string) => Promise<import('./login').LoginSummary>
  loginSave: (sessionId: string, input: import('./login').SavedLogin) => Promise<import('./login').LoginSummary>
  loginRemove: (sessionId: string) => Promise<void>
  loginRun: (sessionId: string) => Promise<{ok: true}>

  open: (sessionId: string, url: string, bounds: BrowserBounds, fresh?: boolean) => Promise<BrowserState>
  navigate: (sessionId: string, url: string) => Promise<void>
  action: (sessionId: string, action: BrowserAction) => Promise<void>
  bounds: (sessionId: string, bounds: BrowserBounds) => void
  close: (sessionId: string) => Promise<void>
  teachHosted: (sessionId: string) => Promise<RecordingStatus>
  recordingControl: (sessionId: string, action: 'pause' | 'resume' | 'stop') => Promise<RecordingStatus>
  prepareHosted: (workflowId: string, nodes: {id: string; url: string}[]) => Promise<void>
  learnedSteps: (workflowId: string, nodeIds: string[]) => Promise<{ nodeId: string; status: 'Needs teaching' | 'Recorded' | 'Learned' }[]>
  syncSecrets: (sessionId: string) => Promise<RecordingStatus>
  recordingStatus: (sessionId: string) => Promise<RecordingStatus>
  recordingExport: (sessionId: string) => Promise<string>
  replayArtifact: (sessionId: string, runId: string, artifactId: string, action: 'preview' | 'reveal') => Promise<string>
  replayFolder: (sessionId: string) => Promise<void>
  replaySaveInputs: (sessionId: string, inputs: ReplayPreview['inputs']) => Promise<void>
  replayPreview: (sessionId: string) => Promise<ReplayPreview>
  replayStart: (sessionId: string, authorizeRecordedActions?: boolean, resume?: boolean, mode?: 'fast' | 'demo') => Promise<void>
  diagnostics: (sessionId: string) => Promise<{ windowFocused: boolean; browserFocused: boolean; visible: boolean; captureReady: boolean; eventCount: number; lastEventType?: string; bounds: { x: number; y: number; width: number; height: number } }>
  replayApprove: (sessionId: string, sequence: number, approved: boolean) => Promise<void>
  replayCancel: (sessionId: string) => Promise<void>
  onReplay: (listener: (value: { sessionId: string; status: ReplayStatus }) => void) => () => void
  onRecorded: (listener: (event: { sessionId: string; event: RecordedEvent; status: RecordingStatus }) => void) => () => void
  onState: (listener: (state: BrowserState) => void) => () => void
}
