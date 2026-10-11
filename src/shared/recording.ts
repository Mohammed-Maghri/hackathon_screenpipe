export interface RecordedEvent {
  sequence: number
  timestamp: string
  elapsedMs: number
  type: string
  url: string
  data: Record<string, unknown>
}
export interface RecordingStatus {
  id: string
  state: 'recording' | 'paused' | 'stopped'
  eventCount: number
  path: string
  error: string | null
}
export interface ReplayPreview {
  inputs: { sequence: number; label: string; value: string }[]
  steps: number
  startURL: string | null
  blockers: string[]
}
export interface ReplayStatus {
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
  redacted?: boolean
  shadowHost?: string | null
  attributes?: Record<string, string>
  context?: { role: string; name: string; testId: string; id: string }
  frame?: 'main'
}
export type ActionState = 'pending' | 'running' | 'verified' | 'failed' | 'skipped' | 'unknown' | 'needs-user-approval'
export interface ActionResult { sequence: number; type: string; state: ActionState; evidence?: string }
export interface PageEvidence { target: TargetDescriptor; text?: string; expanded?: string; pressed?: string; absent?: boolean }
