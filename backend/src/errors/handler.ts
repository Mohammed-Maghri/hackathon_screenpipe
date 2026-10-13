import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { Prisma } from '../generated/prisma/client.js'
export class ApiError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message) }
}
export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } }))
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', issues: error.issues.map(i => ({ path: i.path, message: i.message })) } })
    if (error instanceof ApiError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } })
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Workflow not found' } })
      if (['P2002', 'P2003', 'P2014', 'P2034'].includes(error.code)) return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Conflicting workflow data or concurrent update' } })
    }
    const status = (error as { statusCode?: number }).statusCode
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: { code: 'BAD_REQUEST', message: 'Request could not be processed' } })
    // Do not log raw database errors, request bodies, URLs or credentials.
    request.log.error({ requestId: request.id, errorType: error instanceof Error ? error.name : 'Unknown' }, 'Request failed')
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  })
}
