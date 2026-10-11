import type { RecordedEvent, RecordingStatus, ReplayPreview, ReplayStatus } from './recording'
export interface BrowserBounds { x: number; y: number; width: number; height: number; visible: boolean }
export interface BrowserState { sessionId: string; url: string; title: string; loading: boolean; canGoBack: boolean; canGoForward: boolean; error: string | null }
export type BrowserAction = 'back' | 'forward' | 'reload' | 'stop'
export interface TeachingBrowser {
  open: (sessionId: string, url: string, bounds: BrowserBounds) => Promise<BrowserState>
  navigate: (sessionId: string, url: string) => Promise<void>
  action: (sessionId: string, action: BrowserAction) => Promise<void>
  bounds: (sessionId: string, bounds: BrowserBounds) => void
  close: (sessionId: string) => Promise<void>
  recordingControl: (sessionId: string, action: 'pause' | 'resume' | 'stop') => Promise<RecordingStatus>
  recordingStatus: (sessionId: string) => Promise<RecordingStatus>
  recordingExport: (sessionId: string) => Promise<string>
  replaySaveInputs: (sessionId: string, inputs: ReplayPreview['inputs']) => Promise<void>
  replayPreview: (sessionId: string) => Promise<ReplayPreview>
  replayStart: (sessionId: string) => Promise<void>
  diagnostics: (sessionId: string) => Promise<{ windowFocused: boolean; browserFocused: boolean; visible: boolean; captureReady: boolean; eventCount: number; lastEventType?: string; bounds: { x: number; y: number; width: number; height: number } }>
  replayApprove: (sessionId: string, sequence: number, approved: boolean) => Promise<void>
  replayCancel: (sessionId: string) => Promise<void>
  onReplay: (listener: (value: { sessionId: string; status: ReplayStatus }) => void) => () => void
  onRecorded: (listener: (event: { sessionId: string; event: RecordedEvent; status: RecordingStatus }) => void) => () => void
  onState: (listener: (state: BrowserState) => void) => () => void
}
