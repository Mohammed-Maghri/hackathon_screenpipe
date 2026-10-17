import { z } from 'zod'
import { discoveryInputSchema } from './screenpipeDiscovery.js'
export const agentResultSchema = z.object({
  requestId: z.string().uuid(),
  workflow: z.object({ name: z.string().min(1).max(200), description: z.string().max(10000) }).strict(),
  steps: z.array(z.object({
    id: z.string().min(1).max(100), name: z.string().min(1).max(200), description: z.string().max(2000),
    application: z.string().min(1).max(100), type: z.enum(['browser', 'application']),
    startUrl: z.string().url().nullable(), basis: z.enum(['observed', 'inferred']),
    references: z.array(z.string().min(1).max(2000)).max(20),
    missingInformation: z.array(z.string().max(500)).max(20),
  }).strict()).max(12),
  missingInformation: z.array(z.string().max(500)).max(20),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.steps.map(s => s.id)).size !== v.steps.length) ctx.addIssue({ code: 'custom', message: 'Duplicate step IDs' })
  for (const step of v.steps) {
    if (step.type !== 'browser' && step.startUrl !== null) ctx.addIssue({ code: 'custom', message: 'Only browser steps can have URLs' })
    if (step.basis === 'inferred' && !step.missingInformation.length) ctx.addIssue({ code: 'custom', message: 'Inferred steps need confirmation details' })
  }
})
export const agentSaveSchema = discoveryInputSchema.extend({
  pipeId: z.literal('ghost-workflow-discovery'), executionId: z.number().int().positive(),
  result: agentResultSchema,
}).strict().refine(v => v.result.requestId === v.requestId, 'Result belongs to another request')
export const agentFormatSchema = discoveryInputSchema.extend({
  pipeId: z.literal('ghost-workflow-discovery'), executionId: z.number().int().positive(),
  responseText: z.string().min(1).max(131072).refine(v => v.trim().length > 0),
}).strict()
