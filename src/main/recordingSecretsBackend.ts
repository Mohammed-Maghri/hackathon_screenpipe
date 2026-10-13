import type { RecordingSecrets } from './recordingSecrets'

export async function recordingSecretsBackend(secrets: RecordingSecrets, context: string, value?: unknown): Promise<unknown> {
  const base = new URL(process.env.GHOST_BACKEND_URL || 'http://127.0.0.1:3001')
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)
  if (base.username || base.password || (base.protocol !== 'https:' && !(local && base.protocol === 'http:'))) throw new Error('Credential sync requires HTTPS or a local backend.')
  const response = await fetch(new URL('/api/recording-secrets', base), {
    method: value === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${secrets.backendToken(context)}`, 'Content-Type': 'application/json' },
    ...(value === undefined ? {} : { body: JSON.stringify(secrets.encrypt(JSON.stringify(value), context)) }),
    signal: AbortSignal.timeout(4000), redirect: 'error',
  })
  if (value === undefined && response.status === 404) return null
  if (!response.ok) throw new Error('Backend credential storage unavailable.')
  const result = await response.json()
  if (value !== undefined) {
    if (result?.saved !== true) throw new Error('Backend did not confirm credential storage.')
    return true
  }
  return JSON.parse(secrets.decrypt(result, context))
}
