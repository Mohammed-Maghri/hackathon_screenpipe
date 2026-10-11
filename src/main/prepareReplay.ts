import { buildReplayPlan } from './replayPlan'
import { applyInputs, type SavedInput } from './replaySettings'
import type { RecordedEvent } from '../shared/recording'

// IPC and tests share this path. Apply overrides to the complete log, then plan once.
// Unsupported events and their validation evidence are never filtered before validation.
// Raw sequence IDs also keep older overrides valid when newer deduplication merges edits.
export function prepareReplay(events: RecordedEvent[], inputs: SavedInput[] = []) {
  return buildReplayPlan(applyInputs(events, inputs))
}
