import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import type { FastifyInstance, FastifySchema } from 'fastify'
import { z } from 'zod'
import { createWorkflowSchema, updateWorkflowSchema, workflowParamsSchema, listWorkflowsSchema } from '../modules/workflows/workflow.schemas.js'
import { prepareDiscoverySchema, preparedDiscoverySchema } from '../modules/discovery/discovery.schemas.js'

const json = (schema: z.ZodType) => {
  const { $schema: _dialect, ...result } = z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' })
  return result
}
const error = { type: 'object', properties: { error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' }, issues: { type: 'array', items: { type: 'object', properties: { path: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'integer' }] } }, message: { type: 'string' } } } } } } } }
const errors = { 400: error, 500: error }
const timestamps = { createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' } }
const uuid = { type: 'string', format: 'uuid' }
const workflowProperties = { id: uuid, ownerId: { ...uuid, nullable: true }, name: { type: 'string' }, description: { type: 'string', nullable: true }, status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] }, ...timestamps }
const graphProperties = json(createWorkflowSchema).properties as Record<string, { items: { properties: Record<string, unknown> } }>
const workflow = { type: 'object', properties: { ...workflowProperties,
  nodes: { type: 'array', items: { type: 'object', properties: { ...graphProperties.nodes!.items.properties, workflowId: uuid, ...timestamps } } },
  edges: { type: 'array', items: { type: 'object', properties: { ...graphProperties.edges!.items.properties, workflowId: uuid, ...timestamps } } },
} }
const health = { type: 'object', properties: { status: { type: 'string', enum: ['ok', 'unavailable'] }, database: { type: 'string', enum: ['up', 'down'] } } }
const contracts: Record<string, FastifySchema> = {
  'GET /health': { tags: ['Health'], summary: 'Check API and database availability', response: { 200: health, 503: health } },
  'POST /api/workflow-discovery/prepare': { tags: ['Discovery'], summary: 'Prepare high-level workflow discovery messages', description: 'Preserves the original user prompt. Does not call AI, read Screenpipe activity, persist a workflow, or execute actions. Context files are not uploaded.', body: json(prepareDiscoverySchema), response: { 200: json(preparedDiscoverySchema), ...errors } },
  'GET /api/workflows': { tags: ['Workflows'], summary: 'List workflows', querystring: json(listWorkflowsSchema), response: { 200: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { ...workflowProperties, _count: { type: 'object', properties: { nodes: { type: 'integer' }, edges: { type: 'integer' } } } } } }, total: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' } } }, ...errors } },
  'POST /api/workflows': { tags: ['Workflows'], summary: 'Create workflow and graph', description: 'Node IDs must be unique, edges must reference nodes in this graph, and self/duplicate edges are rejected.', body: json(createWorkflowSchema), response: { 201: workflow, ...errors, 409: error } },
  'GET /api/workflows/:id': { tags: ['Workflows'], summary: 'Get workflow with nodes and edges', params: json(workflowParamsSchema), response: { 200: workflow, ...errors, 404: error } },
  'PATCH /api/workflows/:id': { tags: ['Workflows'], summary: 'Update workflow', description: 'Provide at least one field. Nodes and edges must be supplied together and replace the graph atomically. Graph replacement is rejected when run history exists.', params: json(workflowParamsSchema), body: json(updateWorkflowSchema), response: { 200: workflow, ...errors, 404: error, 409: error } },
  'DELETE /api/workflows/:id': { tags: ['Workflows'], summary: 'Delete workflow, graph, and run history', params: json(workflowParamsSchema), response: { 204: { type: 'null', description: 'Deleted; no response body' }, ...errors, 404: error, 409: error } },
}
export async function registerDocumentation(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: { info: { title: 'Ghost API', version: '0.1.0', description: 'Development backend foundation. Authentication and live AI discovery are not implemented.' } },
    // Documentation only: preserve existing Zod validation and response serialization.
    transform: ({ schema, url, route }) => ({ schema: { ...schema, ...contracts[`${route.method} ${url}`] }, url }),
  })
  await app.register(swaggerUI, { routePrefix: '/docs' })
}
