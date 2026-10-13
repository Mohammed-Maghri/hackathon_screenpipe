// Real Home form -> sandboxed preload -> main IPC -> actual Fastify endpoint.
// No database or AI provider is accessed.
import electronPath from 'electron'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { buildApp } from '../backend/dist/app.js'
let saved = []
const fixture = { id: '40000000-0000-4000-8000-000000000001', name: 'Backend-only test workflow', description: 'Persisted API fixture', status: 'DRAFT', updatedAt: new Date().toISOString(), _count: { nodes: 1, edges: 0 } }
const database = {
  $disconnect: async () => {},
  $transaction: operations => Promise.all(operations),
  workflow: {
    findMany: async ({ skip, take }) => saved.slice(skip, skip + take),
    count: async () => saved.length,
    findUniqueOrThrow: async () => ({ ...fixture, nodes: [{ id: 'node-1', label: 'Real saved node', type: 'ACTION', positionX: 0, positionY: 0, config: {} }], edges: [] }),
  },
}
let releasePreparation
const preparationGate = new Promise(resolve => { releasePreparation = resolve })
const backend = await buildApp({ NODE_ENV: 'test', LOG_LEVEL: 'silent', CORS_ORIGINS: [], DATABASE_URL: 'postgresql://unused:unused@localhost/unused' }, database)
const requests = []
backend.addHook('preHandler', async request => { if (request.url === '/api/workflow-discovery/prepare') { requests.push(request.body); await preparationGate } })
const address = await backend.listen({ port: 0, host: '127.0.0.1' })
const profile = await mkdtemp('/tmp/ghost-discovery-test-')
const child = spawn(electronPath, ['.', '--ozone-platform=x11', '--remote-debugging-port=0', `--user-data-dir=${profile}`], { env: { ...process.env, GHOST_BACKEND_URL: address }, stdio: ['ignore', 'ignore', 'pipe'] })
let logs = '', socket
child.stderr.on('data', data => { logs += data })
async function until(fn) { for (let i = 0; i < 200; i++) { const value = await fn(); if (value) return value; await new Promise(r => setTimeout(r, 50)) } throw new Error('Timed out') }
try {
  const port = await until(() => logs.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)?.[1])
  const target = await until(async () => (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(page => page.url.includes('index.html')))
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let id = 0
  const pending = new Map()
  socket.onmessage = event => { const data = JSON.parse(event.data); if (data.id) { pending.get(data.id)?.(data); pending.delete(data.id) } }
  async function evaluate(expression) {
    const n = ++id
    const response = new Promise(resolve => pending.set(n, resolve))
    socket.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }))
    const result = await Promise.race([response, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('CDP timeout')), 15000); timer.unref() })])
    if (result.error || result.result.exceptionDetails) throw new Error(JSON.stringify(result))
    return result.result.result.value
  }
  await evaluate("location.hash='/dashboard'")
  await until(() => evaluate('!!window.ghost?.prepareDiscovery && !!document.querySelector("textarea")'))
  await until(() => evaluate(`document.querySelector('.discovery-panel').textContent.includes('No saved workflows yet')`))
  assert.equal(await evaluate(`document.querySelector('.discovery-panel').textContent.includes('Daily Orders Report')`), false)
  saved = [fixture]
  await evaluate(`document.querySelector('.discovery-panel .text-button').click()`)
  await until(() => evaluate(`document.querySelector('.discovery-panel').textContent.includes('Backend-only test workflow')`))
  await evaluate(`document.querySelector('.discovery-panel .workflow-card button').click()`)
  await until(() => evaluate(`document.querySelector('dialog')?.textContent.includes('Real saved node')`))
  await evaluate(`document.querySelector('dialog button[aria-label="Close dialog"]').click()`)
  const original = '  Find my reporting routine\nKeep original whitespace 🚀  '
  await evaluate(`(() => { const field = document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, ${JSON.stringify(original)}); field.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await evaluate(`document.querySelector('.find-workflow').click()`)
  await until(() => evaluate(`document.querySelector('.find-workflow').textContent.includes('Generating') && document.querySelector('.find-workflow').disabled`))
  await evaluate(`document.querySelector('.find-workflow').click()`)
  await until(() => requests.length === 1)
  releasePreparation()
  await until(() => evaluate(`document.body.textContent.includes('Generation needs a Screenpipe AI connection')`))
  assert.deepEqual(requests, [{ prompt: original, timeRange: 'Last 7 days' }])
  assert.equal(await evaluate(`document.querySelector('textarea').value`), original)
  assert.equal(await evaluate(`document.querySelector('.find-workflow').disabled`), false)
  await backend.close()
  await evaluate(`document.querySelector('.discovery-panel .text-button').click()`)
  await until(() => evaluate(`document.querySelector('.discovery-panel').textContent.includes('Unable to load workflows')`))
  await evaluate(`document.querySelector('.find-workflow').click()`)
  await until(() => evaluate(`document.body.textContent.includes('Unable to reach the Ghost backend')`))
  assert.equal(await evaluate(`document.querySelector('textarea').value`), original)
  console.log('PASS: real Electron loading/empty/saved workflows, refresh, node review, generation indicator, duplicate protection, provider-blocked state, backend errors and preserved input')
} finally {
  releasePreparation()
  socket?.close()
  if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited }
  await backend.close()
  await rm(profile, { recursive: true, force: true })
}
