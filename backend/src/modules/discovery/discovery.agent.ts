import { agentSaveSchema } from '../../contracts/screenpipeAgent.js'
import { redactCapture, safeObservedUrl } from '../../contracts/screenpipeDiscovery.js'
import { buildGeneratedGraph } from './discovery.generate.js'
import { discoveryRequestHash } from './discovery.screenpipe.js'
import { ApiError } from '../../errors/handler.js'
import type { WorkflowService } from '../workflows/workflow.service.js'
export function buildAgentGraph(raw: unknown) {
  const input = agentSaveSchema.parse(raw), result = input.result
  if (!result.steps.length) throw new ApiError(422, 'NO_WORKFLOW', 'Screenpipe found insufficient history to identify this workflow. Try a different range or request.')
  if (redactCapture(JSON.stringify(result)) !== JSON.stringify(result)) throw new ApiError(422, 'UNSAFE_RESULT', 'The discovery answer contains unsafe URLs or sensitive patterns.')
  for (const s of result.steps) if (s.startUrl && safeObservedUrl(s.startUrl) !== s.startUrl) throw new ApiError(422, 'UNSAFE_URL', 'Confirm a safe starting URL.')
  const graph = buildGeneratedGraph({ name: result.workflow.name, description: result.workflow.description,
    steps: result.steps.map(s => ({ ...s, evidenceId: s.id, contract: null })),
  }, input.requestId)
  graph.description = result.workflow.description
  for (const node of graph.nodes) {
    const steps = result.steps.filter(s => (node.config.evidenceIds as string[]).includes(s.id))
    node.config = { ...node.config, source: 'screenpipe_pipe', generator: 'screenpipe_agent',
      basis: 'unverified', reportedBasis: steps.map(s => s.basis), evidenceIds: [], evidence: [],
      sourceReferences: [...new Set(steps.flatMap(s => s.references))], referencesVerified: false,
      missingInformation: [...new Set([...(node.config.missingInformation as string[]), ...result.missingInformation,
        'Screenpipe agent response; Ghost has not independently verified its observations or references. Confirm the workflow before recording.'])],
      discoveryRequestHash: discoveryRequestHash(input.prompt, input.timeRange),
      discovery: { pipeId: input.pipeId, executionId: input.executionId, timeRange: input.timeRange },
    }
  }
  return graph
}
export async function saveAgentWorkflow(service: WorkflowService, raw: unknown) {
  const input = agentSaveSchema.parse(raw)
  const existing = await service.find(input.requestId)
  if (existing) {
    if (!existing.nodes.length || existing.nodes.some(n => (n.config as Record<string, unknown>).discoveryRequestHash !== discoveryRequestHash(input.prompt, input.timeRange))) throw new ApiError(409, 'REQUEST_CONFLICT', 'Request ID belongs to another workflow.')
    return existing
  }
  return service.create(buildAgentGraph(input), input.requestId)
}
