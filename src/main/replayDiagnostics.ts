import { createHash } from 'node:crypto'
import type { ReplayFailureCode, TargetDescriptor } from '../shared/recording'

export class ReplayFailure extends Error {
 constructor(readonly code: ReplayFailureCode, message: string) { super(message) }
}
export function failureCode(error: unknown): ReplayFailureCode {
 if (error instanceof ReplayFailure) return error.code
 const text = String(error)
 if (/ambiguous|multiple elements/i.test(text)) return 'TARGET_AMBIGUOUS'
 if (/unsupported|no verifiable|no recorded target/i.test(text)) return 'ACTION_UNSUPPORTED'
 if (/missing|not ready|unavailable|not found|covered/i.test(text)) return 'TARGET_NOT_FOUND'
 return 'EXECUTION_FAILED'
}
// Diagnostics never include field values, text content, accessible names or
// exception payloads from CDP. Keep only structural target metadata.
export function diagnosticTarget(target?: TargetDescriptor) {
 if (!target) return undefined
 return { fingerprint: createHash('sha256').update(JSON.stringify(target)).digest('hex').slice(0, 16), tag: target.tag, role: target.role, inputType: target.inputType, credential: !!target.credential,
  hasId: !!target.id, hasTestId: !!target.testId, hasLabel: !!target.label,
  hasName: !!target.accessibleName, hasSelector: !!target.selector }
}
export function transientDOMError(error: unknown) {
 return /execution context.*destroy|cannot find context|frame.*detach|frame.*not ready|frame.*unavailable|frame.*missing|owner not found|document.*unload/i.test(String(error))
}
