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
}).strict()
export const discoveredWorkflowSchema = z.object({
  workflow: z.object({ name: z.string(), description: z.string() }).strict(),
  steps: z.array(z.discriminatedUnion('type', [
    step.extend({ type: z.literal('browser'), status: z.literal('needs_recording'), startUrl: z.string().url().nullable() }),
    step.extend({ type: z.literal('application'), status: z.literal('needs_configuration'), startUrl: z.null() }),
  ])),
  missingInformation: z.array(z.string()),
}).strict()
export type DiscoveryRequest = z.infer<typeof prepareDiscoverySchema>
export type DiscoveredWorkflow = z.infer<typeof discoveredWorkflowSchema>
