import { GHOST_SYSTEM_PROMPT } from './discovery.prompt.js'
import type { DiscoveryRequest } from './discovery.schemas.js'
export function prepareDiscovery(input: DiscoveryRequest) {
  return {
    status: 'prepared' as const,
    integrationStatus: 'not_connected' as const,
    timeRange: input.timeRange,
    messages: [
      { role: 'system' as const, content: GHOST_SYSTEM_PROMPT },
      { role: 'user' as const, content: input.prompt },
    ],
  }
}
