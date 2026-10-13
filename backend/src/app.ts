import Fastify from 'fastify'
import { registerDocumentation } from './documentation/swagger.js'
import { registerDiscoveryRoutes } from './modules/discovery/discovery.routes.js'
import cors from '@fastify/cors'
import type { Environment } from './config/env.js'
import { createDatabase, type Database } from './database/client.js'
import { registerErrorHandler } from './errors/handler.js'
import { WorkflowService } from './modules/workflows/workflow.service.js'
import { registerWorkflowRoutes } from './modules/workflows/workflow.routes.js'
export async function buildApp(env: Environment, database?: Database) {
  const db = database ?? createDatabase(env.DATABASE_URL)
  const app = Fastify({
    bodyLimit: 1048576,
    logger: { level: env.LOG_LEVEL, serializers: { req: req => ({ method: req.method, id: req.id }), res: res => ({ statusCode: res.statusCode }) }, redact: ['req.headers.authorization', 'req.headers.cookie'] },
  })
  app.addHook('onClose', async () => { await db.$disconnect() })
  registerErrorHandler(app)
  await app.register(cors, { origin: env.CORS_ORIGINS, methods: ['GET', 'POST', 'PATCH', 'DELETE'], credentials: false })
  await registerDocumentation(app)
  registerDiscoveryRoutes(app)
  app.get('/health', async (_request, reply) => {
    try { await db.$queryRaw`SELECT 1`; return { status: 'ok', database: 'up' } }
    catch { return reply.code(503).send({ status: 'unavailable', database: 'down' }) }
  })
  registerWorkflowRoutes(app, new WorkflowService(db))
  return app
}
