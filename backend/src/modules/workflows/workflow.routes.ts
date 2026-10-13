import { defineWorkflowContracts } from './node-contract.generate.js'
import { workflowParamsSchema } from './workflow.schemas.js'
import type { FastifyInstance } from 'fastify'
import type { WorkflowService } from './workflow.service.js'
import { workflowController } from './workflow.controller.js'
export function registerWorkflowRoutes(app: FastifyInstance, service: WorkflowService, config: { apiKey?: string; model?: string } = {}) {
  const controller = workflowController(service)
  app.post('/api/workflows/:id/contracts', request => defineWorkflowContracts(service, workflowParamsSchema.parse(request.params).id, config))
  app.get('/api/workflows', controller.list)
  app.post('/api/workflows', controller.create)
  app.get('/api/workflows/:id', controller.get)
  app.patch('/api/workflows/:id', controller.update)
  app.delete('/api/workflows/:id', controller.delete)
}
