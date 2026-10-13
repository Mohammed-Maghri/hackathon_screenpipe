import { z } from 'zod'
const uuid = z.string().uuid()
const node = z.object({ id: uuid, type: z.enum(['TRIGGER', 'ACTION', 'CONDITION', 'TRANSFORM', 'OUTPUT']), label: z.string().trim().min(1).max(200), positionX: z.number().finite().default(0), positionY: z.number().finite().default(0), config: z.record(z.string(), z.json()).default({}) }).strict()
const edge = z.object({ id: uuid, sourceNodeId: uuid, targetNodeId: uuid, label: z.string().max(200).nullable().optional() }).strict()
const fields = {
  name: z.string().trim().min(1).max(200), description: z.string().max(10000).nullable().optional(),
  ownerId: uuid.nullable().optional(), status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  nodes: z.array(node).max(500), edges: z.array(edge).max(2000),
}
function validateGraph(data: { nodes?: z.infer<typeof node>[]; edges?: z.infer<typeof edge>[] }, ctx: z.RefinementCtx) {
  if ((data.nodes === undefined) !== (data.edges === undefined)) ctx.addIssue({ code: 'custom', message: 'Provide nodes and edges together', path: ['nodes'] })
  if (!data.nodes || !data.edges) return
  const ids = new Set(data.nodes.map(n => n.id))
  if (ids.size !== data.nodes.length) ctx.addIssue({ code: 'custom', message: 'Duplicate node IDs', path: ['nodes'] })
  const edgeIds = new Set<string>(), pairs = new Set<string>()
  for (const [index, e] of data.edges.entries()) {
    const pair = `${e.sourceNodeId}:${e.targetNodeId}`
    if (!ids.has(e.sourceNodeId) || !ids.has(e.targetNodeId) || e.sourceNodeId === e.targetNodeId || edgeIds.has(e.id) || pairs.has(pair)) ctx.addIssue({ code: 'custom', message: 'Invalid or duplicate edge', path: ['edges', index] })
    edgeIds.add(e.id); pairs.add(pair)
  }
}
export const createWorkflowSchema = z.object({ ...fields, status: fields.status.default('DRAFT'), nodes: fields.nodes.default([]), edges: fields.edges.default([]) }).strict().superRefine(validateGraph)
export const updateWorkflowSchema = z.object(fields).partial().strict().refine(v => Object.keys(v).length > 0, 'At least one field is required').superRefine(validateGraph)
export const workflowParamsSchema = z.object({ id: uuid }).strict()
export const listWorkflowsSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), offset: z.coerce.number().int().min(0).max(100000).default(0), status: fields.status.optional(), ownerId: uuid.optional() }).strict()
export type CreateWorkflow = z.infer<typeof createWorkflowSchema>
export type UpdateWorkflow = z.infer<typeof updateWorkflowSchema>
export type ListWorkflows = z.infer<typeof listWorkflowsSchema>
