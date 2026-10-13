import { z } from 'zod'
import type { Environment } from '../../config/env.js'
import type { WorkflowService } from '../workflows/workflow.service.js'
import { ApiError } from '../../errors/handler.js'
import { getMockActivity } from './discovery.mock.js'
import { generateAndSave } from './discovery.generate.js'
import type { FastifyInstance } from 'fastify'
import { prepareDiscoverySchema } from './discovery.schemas.js'
import { prepareDiscovery } from './discovery.service.js'
export function registerDiscoveryRoutes(app: FastifyInstance, service: WorkflowService, env: Environment) {
  const active = new Set<string>()
  const guard = () => { if (env.NODE_ENV === 'production') throw new ApiError(403, 'DEV_ONLY', 'Mock discovery is available only in development.') }
  app.post('/api/workflow-discovery/mock', async request => {
    guard(); prepareDiscoverySchema.parse(request.body)
    return getMockActivity()
  })
  app.post('/api/workflow-discovery/generate', async request => {
    guard()
    const input = prepareDiscoverySchema.extend({ requestId: z.string().uuid() }).parse(request.body)
    if (active.has(input.requestId)) throw new ApiError(409, 'GENERATION_RUNNING', 'This request is already generating. Wait before retrying.')
    active.add(input.requestId)
    try { return await generateAndSave(service, input.prompt, input.requestId, { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL }) }
    finally { active.delete(input.requestId) }
  })
  app.post('/api/workflow-discovery/prepare', async request => prepareDiscovery(prepareDiscoverySchema.parse(request.body)))
}
