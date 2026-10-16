import type { FastifyReply, FastifyRequest } from 'fastify'
import type { WorkflowService } from './workflow.service.js'
import { createWorkflowSchema, updateWorkflowSchema, workflowParamsSchema, listWorkflowsSchema } from './workflow.schemas.js'
export function workflowController(service: WorkflowService) {
  return {
    list: async (request: FastifyRequest) => service.list(listWorkflowsSchema.parse(request.query)),
    get: async (request: FastifyRequest) => service.get(workflowParamsSchema.parse(request.params).id),
    create: async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await service.create(createWorkflowSchema.parse(request.body))
      return reply.code(201).header('Location', `/api/workflows/${result.id}`).send(result)
    },
    update: async (request: FastifyRequest) => service.update(workflowParamsSchema.parse(request.params).id, updateWorkflowSchema.parse(request.body)),
    delete: async (request: FastifyRequest, reply: FastifyReply) => {
      await service.delete(workflowParamsSchema.parse(request.params).id)
      return reply.code(204).send()
    },
  }
}
