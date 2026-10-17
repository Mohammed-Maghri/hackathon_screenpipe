import { createHash } from 'node:crypto'
import { screenpipeSaveSchema, redactCapture, safeObservedUrl } from '../../contracts/screenpipeDiscovery.js'
import { discoveredWorkflowSchema } from './discovery.schemas.js'
import { buildGeneratedGraph } from './discovery.generate.js'
import { ApiError } from '../../errors/handler.js'
import type { WorkflowService } from '../workflows/workflow.service.js'

export function discoveryRequestHash(prompt: string, timeRange: string) {
  return createHash('sha256').update(JSON.stringify({ prompt, timeRange })).digest('hex')
}
export function buildScreenpipeGraph(raw: unknown) {
  const input = screenpipeSaveSchema.parse(raw)
  const output = discoveredWorkflowSchema.parse(input.output)
  if (!output.steps.length) throw new ApiError(422, 'SCREENPIPE_INSUFFICIENT_EVIDENCE', 'Screenpipe could not identify this workflow from the selected activity. Try a more specific request or another time range.')
  if (output.steps.length > 12) throw new ApiError(422, 'INVALID_SCREENPIPE_OUTPUT', 'Screenpipe returned too many workflow steps.')
  const duration = { 'Last 24 hours': 1, 'Last 7 days': 7, 'Last 30 days': 30 }[input.timeRange] * 86400000
  if (Date.parse(input.endTime) - Date.parse(input.startTime) !== duration) throw new ApiError(400, 'INVALID_EVIDENCE', 'Activity bounds do not match the selected time range.')
  const evidence = new Map(input.evidence.map(item => [item.id, item]))
  if (evidence.size !== input.evidence.length || input.evidence.some(item => Date.parse(item.timestamp) < Date.parse(input.startTime) || Date.parse(item.timestamp) > Date.parse(input.endTime) || (item.url !== null && safeObservedUrl(item.url) !== item.url))) throw new ApiError(400, 'INVALID_EVIDENCE', 'Activity references are duplicated, unsafe or outside the selected time range.')
  // Reject known credential patterns instead of persisting model-echoed secrets.
  const serialized = JSON.stringify(output)
  if (redactCapture(serialized) !== serialized) throw new ApiError(422, 'INVALID_SCREENPIPE_OUTPUT', 'Screenpipe returned sensitive or unsafe content. No workflow was saved.')
  for (const step of output.steps) {
    if (!step.evidenceIds.every(id => evidence.has(id))) throw new ApiError(422, 'INVALID_SCREENPIPE_EVIDENCE', 'Screenpipe returned an evidence reference outside the retrieved activity. No workflow was saved.')
    const sources = step.evidenceIds.map(id => evidence.get(id)!)
    for (const url of [step.startUrl, step.websiteUrl]) {
      if (url !== null && (!sources.some(source => source.url === url) || safeObservedUrl(url) !== url)) throw new ApiError(422, 'INVALID_SCREENPIPE_EVIDENCE', 'A generated URL is not present in the cited Screenpipe activity.')
    }
    if (step.domain !== null && !sources.some(source => source.url && new URL(source.url).hostname === step.domain)) throw new ApiError(422, 'INVALID_SCREENPIPE_EVIDENCE', 'A generated domain is not present in the cited activity.')
    if (step.basis === 'inferred' && !step.missingInformation.length) throw new ApiError(422, 'INVALID_SCREENPIPE_OUTPUT', 'Inferred steps must identify what needs confirmation.')
  }
  const graph = buildGeneratedGraph({ name: output.workflow.name, description: output.workflow.description,
    steps: output.steps.map(step => ({ name: step.name, description: step.description, application: step.application, type: step.type, startUrl: step.startUrl, contract: step.contract ?? null, evidenceId: step.id, missingInformation: step.missingInformation })),
  }, input.requestId)
  graph.description = output.workflow.description
  const hash = discoveryRequestHash(input.prompt, input.timeRange)
  for (const node of graph.nodes) {
    const steps = output.steps.filter(step => (node.config.evidenceIds as string[]).includes(step.id))
    const ids = [...new Set(steps.flatMap(step => step.evidenceIds))]
    node.config = { ...node.config, source: 'screenpipe', generator: 'screenpipe_local_ai', discoveryRequestHash: hash,
      basis: steps.some(step => step.basis === 'inferred') ? 'inferred' : 'observed', evidenceIds: ids,
      evidence: ids.map(id => evidence.get(id)!), pageNames: [...new Set(steps.flatMap(step => step.pageNames))],
      expectedOutcomes: steps.flatMap(step => step.expectedOutcome ? [step.expectedOutcome] : []),
      missingInformation: [...new Set([...(node.config.missingInformation as string[]), ...output.missingInformation, ...(input.truncated ? ['Discovery used a bounded activity sample; confirm that the workflow is complete.'] : [])])],
      discovery: { startTime: input.startTime, endTime: input.endTime, truncated: input.truncated },
    }
  }
  return graph
}
export async function saveScreenpipeWorkflow(service: WorkflowService, raw: unknown) {
  const input = screenpipeSaveSchema.parse(raw)
  const hash = discoveryRequestHash(input.prompt, input.timeRange)
  const existing = await service.find(input.requestId)
  if (existing) {
    if (!existing.nodes.length || existing.nodes.some(node => (node.config as Record<string, unknown>).discoveryRequestHash !== hash)) throw new ApiError(409, 'DISCOVERY_REQUEST_CONFLICT', 'This request ID belongs to a different workflow request.')
    return existing
  }
  return service.create(buildScreenpipeGraph(input), input.requestId)
}
