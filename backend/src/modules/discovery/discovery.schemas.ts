import { nodeContractSchema, configureNodeContracts } from '../workflows/node-contract.js'
import { z } from 'zod'
export const prepareDiscoverySchema = z.object({
  // Do not trim: preserve the user's original input in the separate user message.
  prompt: z.string().max(10000).refine(value => value.trim().length > 0, 'A prompt is required'),
  timeRange: z.enum(['Last 24 hours', 'Last 7 days', 'Last 30 days']).default('Last 7 days'),
}).strict()
export const preparedDiscoverySchema = z.object({
  status: z.literal('prepared'),
  integrationStatus: z.literal('not_connected'),
  timeRange: prepareDiscoverySchema.shape.timeRange,
  messages: z.tuple([
    z.object({ role: z.literal('system'), content: z.string() }),
    z.object({ role: z.literal('user'), content: z.string() }),
  ]),
})
// Contract for the future provider response. This endpoint does not generate a workflow.
const step = z.object({
  id: z.string().min(1), name: z.string().min(1), application: z.string().min(1),
  description: z.string(), websiteUrl: z.string().url().nullable(), domain: z.string().nullable(),
  pageNames: z.array(z.string()), basis: z.enum(['observed', 'inferred']),
  expectedOutcome: z.string().nullable(), evidenceIds: z.array(z.string().min(1)).min(1),
  missingInformation: z.array(z.string()),
  contract: nodeContractSchema.nullable().optional(),
}).strict()
export const discoveredWorkflowSchema = z.object({
  workflow: z.object({ name: z.string(), description: z.string() }).strict(),
  steps: z.array(z.discriminatedUnion('type', [
    step.extend({ type: z.literal('browser'), status: z.literal('needs_recording'), startUrl: z.string().url().nullable() }),
    step.extend({ type: z.literal('application'), status: z.literal('needs_configuration'), startUrl: z.null() }),
    step.extend({ type: z.literal('logic'), status: z.literal('needs_configuration'), startUrl: z.null(), contract: nodeContractSchema }),
    step.extend({ type: z.literal('review'), status: z.literal('needs_configuration'), startUrl: z.null(), contract: nodeContractSchema }),
  ])),
  missingInformation: z.array(z.string()),
}).strict().superRefine((value, ctx) => {
  try {
    if (new Set(value.steps.map(step => step.id)).size !== value.steps.length) throw new Error('Duplicate step IDs')
    configureNodeContracts(value.steps.map(step => ({ id: step.id, config: { stepType: step.type, contract: step.contract, description: step.description } })), value.steps.slice(1).map((step, index) => ({ sourceNodeId: value.steps[index]!.id, targetNodeId: step.id })))
  } catch { ctx.addIssue({ code: 'custom', message: 'Invalid step input/output contracts', path: ['steps'] }) }
})
export type DiscoveryRequest = z.infer<typeof prepareDiscoverySchema>
export type DiscoveredWorkflow = z.infer<typeof discoveredWorkflowSchema>
