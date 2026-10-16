export interface FrameIdentity { name: string; url: string }

export interface RecordedEvent {
  sequence: number
  timestamp: string
  elapsedMs: number
  type: string
  url: string
  data: Record<string, unknown>
}
export interface RecordingStatus {
  secretSync?: 'none' | 'pending' | 'saved' | 'failed'
  id: string
  state: 'recording' | 'paused' | 'stopped'
  eventCount: number
  path: string
  error: string | null
}
export interface ReplayPreview {
  inputSource?: 'backend' | 'local'
  notes?: string[]
  inputs: { sequence: number; label: string; value: string; secret?: boolean; saved?: boolean }[]
  steps: number
  startURL: string | null
  blockers: string[]
}
export type ReplayFailureCode = 'TARGET_NOT_FOUND' | 'TARGET_AMBIGUOUS' | 'ACTION_UNSUPPORTED' | 'EXECUTION_FAILED' | 'VERIFICATION_TIMEOUT' | 'OUTCOME_UNKNOWN' | 'RESUME_REJECTED' | 'CANCELLED'
export interface ActionDiagnostics {
 recordedTarget?: Record<string, unknown>
 resolvedTarget?: Record<string, unknown>
 locatorStrategy?: string
 precondition: string
 execution: 'not-dispatched' | 'dispatching' | 'dispatched' | 'not-needed'
 verification: 'not-started' | 'waiting' | 'satisfied' | 'timeout'
 recoveryAttempts: number
 locatorAttempts: number
 failureCode?: ReplayFailureCode
 underlyingCode?: ReplayFailureCode
 failureReason?: string
}
export interface ReplayArtifact { id: string; filename: string; path: string; bytes: number; mimeType: string; state: string; sequence: number }
export interface ReplayStatus {
  runId?: string
  startedAt?: string
  finishedAt?: string
  structuredOutputs?: Record<string, import('./dataProcessing').DataValue>
  artifacts?: ReplayArtifact[]
 workflowId?: string
 recordingId?: string
 planHash?: string
 currentActionIndex?: number
 lastVerifiedCheckpoint?: number
 observedURL?: string
 documentToken?: string
 failureCode?: ReplayFailureCode
 resumable?: boolean

  state: 'running' | 'completed' | 'failed' | 'cancelled' | 'needs-user-approval' | 'unknown'
  results?: ActionResult[]
  completed: number
  total: number
  sequence: number | null
  action: string
  error: string | null
}

export interface TargetDescriptor {
  selector: string
  tag?: string
  id?: string
  stableId?: string
  testId?: string
  role?: string
  accessibleName?: string
  label?: string
  text?: string
  placeholder?: string
  inputType?: string
  name?: string
  credential?: boolean
  loginAction?: boolean
  redacted?: boolean
  shadowHost?: string | null
  attributes?: Record<string, string>
  context?: { role: string; name: string; testId: string; id: string }
  frame?: 'main' | 'subframe'
}
export type ActionState = 'pending' | 'running' | 'verified' | 'failed' | 'skipped' | 'unknown' | 'needs-user-approval'
export interface ActionResult { sequence: number; type: string; state: ActionState; evidence?: string; diagnostics?: ActionDiagnostics }
export interface PageEvidence { target: TargetDescriptor; text?: string; expanded?: string; pressed?: string; absent?: boolean }
