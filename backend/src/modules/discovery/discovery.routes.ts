import type { FastifyInstance } from 'fastify'
import { prepareDiscoverySchema } from './discovery.schemas.js'
import { prepareDiscovery } from './discovery.service.js'
export function registerDiscoveryRoutes(app: FastifyInstance) {
  app.post('/api/workflow-discovery/prepare', async request => prepareDiscovery(prepareDiscoverySchema.parse(request.body)))
}
