import { loadEnvFile } from 'node:process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
if (existsSync(root + '.env')) loadEnvFile(root + '.env')
const base = new URL(process.env.SCREENPIPE_LOCAL_API_URL || 'http://localhost:3030')
if (!['localhost','127.0.0.1','[::1]'].includes(base.hostname) || base.username || base.password || !['http:','https:'].includes(base.protocol)) throw new Error('Use a local Screenpipe API URL.')
const key = process.env.SCREENPIPE_LOCAL_API_KEY
if (!key) throw new Error('Set SCREENPIPE_LOCAL_API_KEY in root .env; never paste it into chat.')
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
const existing = await fetch(new URL('/pipes/ghost-workflow-discovery', base), { headers, signal: AbortSignal.timeout(15000), redirect: 'error' })
if (existing.status === 409) throw new Error('Screenpipe agent service unavailable (409). Reopen Screenpipe and configure its AI preset, then rerun this command.')
if ([401,403].includes(existing.status)) throw new Error('Screenpipe rejected the local token.')
if (existing.ok && !(await existing.json()).error) { console.log('Ghost discovery Pipe already exists. Not overwriting it; verify its instructions match screenpipe/ghost-workflow-discovery/pipe.md.'); process.exit(0) }
if (!existing.ok && existing.status !== 404) throw new Error(`Screenpipe API failed (${existing.status}).`)
const response = await fetch(new URL('/pipes/install', base), { method: 'POST', headers, signal: AbortSignal.timeout(15000), redirect: 'error', body: JSON.stringify({ source: fileURLToPath(new URL('../screenpipe/ghost-workflow-discovery', import.meta.url)) }) })
if (!response.ok || !(await response.json()).success) throw new Error(`Pipe installation failed (${response.status}). Check Screenpipe locally.`)
console.log('Ghost discovery Pipe installed. Verify/select its AI preset in Screenpipe, then restart Ghost.')
