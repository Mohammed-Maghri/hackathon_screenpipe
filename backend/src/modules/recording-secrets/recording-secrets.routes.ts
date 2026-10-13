import { createHash } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Database } from '../../database/client.js'
import { ApiError } from '../../errors/handler.js'

const encrypted = z.object({
  version: z.literal(1),
  iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
  tag: z.string().regex(/^[A-Za-z0-9+/]{22}==$/),
  data: z.string().min(1).max(900000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
}).strict()

// Each recording has a separate unguessable capability. Store only its hash;
// neither plaintext passwords nor the desktop encryption key reach this API.
function scope(request: FastifyRequest) {
  const token = request.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'A recording credential is required.')
  return createHash('sha256').update(token).digest('hex')
}
export function registerRecordingSecretsRoutes(app: FastifyInstance, db: Database) {
  app.post('/api/recording-secrets', async (request, reply) => {
    const id = scope(request)
    const payload = encrypted.parse(request.body)
    await db.recordingSecret.upsert({ where: { id }, create: { id, payload }, update: { payload } })
    return reply.header('Cache-Control', 'no-store').send({ saved: true })
  })
  app.get('/api/recording-secrets', async (request, reply) => {
    const saved = await db.recordingSecret.findUnique({ where: { id: scope(request) } })
    if (!saved) throw new ApiError(404, 'NOT_FOUND', 'No saved credentials for this recording.')
    return reply.header('Cache-Control', 'no-store').send(saved.payload)
  })
  app.delete('/api/recording-secrets', async (request, reply) => {
    await db.recordingSecret.deleteMany({ where: { id: scope(request) } })
    return reply.code(204).send()
  })
}
