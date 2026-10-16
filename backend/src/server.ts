import { buildApp } from './app.js'
import { loadEnvironment } from './config/env.js'
async function main() {
  const env = loadEnvironment()
  const app = await buildApp(env)
  let closing = false
  const shutdown = async () => {
    if (closing) return
    closing = true
    try { await app.close() } catch { process.exitCode = 1 }
  }
  process.once('SIGINT', () => { void shutdown() })
  process.once('SIGTERM', () => { void shutdown() })
  try { await app.listen({ host: env.HOST, port: env.PORT }) }
  catch { await app.close(); throw new Error('Backend could not listen; check host and port') }
}
main().catch(() => { console.error('Ghost backend startup failed. Check environment configuration and port availability.'); process.exitCode = 1 })
