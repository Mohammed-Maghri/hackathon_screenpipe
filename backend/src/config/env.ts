import 'dotenv/config'
import { z } from 'zod'
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().url().refine(value => /^postgres(ql)?:/.test(value), 'PostgreSQL URL required'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173').transform(value => value.split(',').map(v => v.trim()).filter(Boolean)),
})
export type Environment = z.infer<typeof schema>
export function loadEnvironment(): Environment {
  const result = schema.safeParse(process.env)
  if (!result.success) throw new Error(`Invalid environment variables: ${result.error.issues.map(i => i.path.join('.')).join(', ')}`)
  return result.data
}
