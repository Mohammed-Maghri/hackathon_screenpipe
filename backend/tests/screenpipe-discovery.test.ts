import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { buildApp } from '../src/app.js'
import type { Database } from '../src/database/client.js'
import { buildScreenpipeGraph } from '../src/modules/discovery/discovery.screenpipe.js'
import { discoverScreenpipeWorkflow, normalizeObservation } from '../../src/main/screenpipeDiscovery.js'
import { GHOST_SYSTEM_PROMPT } from '../src/modules/discovery/discovery.prompt.js'

const startTime = '2026-10-16T00:00:00.000Z', endTime = '2026-10-17T00:00:00.000Z'
const evidence = { id: 'screenpipe:frame:12', type: 'frame' as const, sourceId: 12, timestamp: endTime, application: 'Chrome', windowName: 'Payments', url: 'http://127.0.0.1:3100/finance' }
const step = { id: 'step_1', name: 'Review payments', application: 'Chrome', description: 'Review invoice totals', type: 'browser' as const, status: 'needs_recording' as const, startUrl: evidence.url, websiteUrl: evidence.url, domain: '127.0.0.1', pageNames: ['Payments'], basis: 'observed' as const, expectedOutcome: null, contract: null, evidenceIds: [evidence.id], missingInformation: [] }
const output = { workflow: { name: 'Payment report', description: 'Review recorded payment activity' }, steps: [step], missingInformation: [] }
const payload = () => ({ prompt: '  Find my payment workflow\n', timeRange: 'Last 24 hours' as const, requestId: randomUUID(), output: structuredClone(output), evidence: [evidence], startTime, endTime, truncated: true })

test('real discovery graph preserves evidence and rejects invented or sensitive fields', async t => {
  await t.test('saved graph has real provenance, needs recording and completeness warning', () => {
    const graph = buildScreenpipeGraph(payload())
    assert.equal(graph.description, output.workflow.description)
    assert.equal(graph.nodes[0]!.config.source, 'screenpipe')
    assert.equal(graph.nodes[0]!.config.generator, 'screenpipe_local_ai')
    assert.deepEqual(graph.nodes[0]!.config.evidenceIds, [evidence.id])
    assert.equal(graph.nodes[0]!.config.status, 'needs_recording')
    assert.match(JSON.stringify(graph.nodes[0]!.config.missingInformation), /bounded activity/)
    assert.ok(!JSON.stringify(graph).includes('development_mock'))
  })
  for (const [name, change] of Object.entries({
    'unknown citation': { evidenceIds: ['invented'] }, 'invented URL': { startUrl: 'https://fake-company.example/' },
    'invented domain': { domain: 'fake-company.example' }, 'executable selector': { selector: '#pay' },
    'unqualified inference': { basis: 'inferred' }, 'secret echo': { description: 'password: demo-secret' },
  })) await t.test(name, () => { const p = payload(); Object.assign(p.output.steps[0]!, change); assert.throws(() => buildScreenpipeGraph(p)) })
  await t.test('missing evidence, out-of-range evidence and empty output stop', () => {
    assert.throws(() => buildScreenpipeGraph({ ...payload(), evidence: [] }))
    assert.throws(() => buildScreenpipeGraph({ ...payload(), evidence: [{ ...evidence, timestamp: '2026-10-15T00:00:00Z' }] }))
    assert.throws(() => buildScreenpipeGraph({ ...payload(), output: { ...output, steps: [] } }), /could not identify/)
  })
  await t.test('flat API results are normalized and sensitive capture redacted', () => {
    const result = normalizeObservation({ type: 'OCR', 'content.frame_id': 12, 'content.timestamp': endTime, 'content.app_name': 'Chrome', 'content.browser_url': evidence.url + '?token=private', 'content.text': 'Payments\npassword: secret\nCookie: private' }, startTime, endTime)
    assert.equal(result?.url, evidence.url)
    assert.ok(!result?.text.includes('secret')); assert.ok(!result?.text.includes('private'))
    assert.equal(normalizeObservation({ type: 'OCR', content: { frame_id: 12, timestamp: startTime, text: 'test' } }, endTime, endTime), null)
  })
})

test('Home discovery main-process path -> Screenpipe -> real Fastify validation/save', async t => {
  const original = globalThis.fetch
  const saved = new Map<string, any>()
  const db = {
    $disconnect: async () => {},
    $transaction: async (fn: any) => fn(db),
    workflow: {
      findUnique: async ({ where }: any) => saved.get(where.id) ?? null,
      findUniqueOrThrow: async ({ where }: any) => { if (!saved.has(where.id)) { const e = new Error('missing') as Error & { statusCode: number }; e.statusCode = 404; throw e }; return saved.get(where.id) },
      create: async ({ data }: any) => { const item = { ...data, nodes: [], edges: [], updatedAt: new Date() }; saved.set(data.id, item); return item },
    },
    workflowNode: { createMany: async ({ data }: any) => { for (const node of data) saved.get(node.workflowId).nodes.push(node) } },
    workflowEdge: { createMany: async ({ data }: any) => { for (const edge of data) saved.get(edge.workflowId).edges.push(edge) } },
  }
  const app = await buildApp({ NODE_ENV: 'test', HOST: '127.0.0.1', PORT: 3001, LOG_LEVEL: 'silent', DATABASE_URL: 'postgresql://unused:unused@localhost/unused', CORS_ORIGINS: [] }, db as unknown as Database)
  let mode = 'ok', aiCalls = 0, searchCalls = 0, saves = 0
  let expectedPrompt = ''
  const config = { url: 'http://localhost:3030', key: 'test-only-secret', backend: 'http://localhost:3001' }
  globalThis.fetch = async (url, init) => {
    const target = new URL(String(url))
    if (target.port === '3001') {
      assert.ok(!JSON.stringify(init?.headers).includes(config.key))
      if (target.pathname === '/api/workflow-discovery/screenpipe') {
        saves++
        assert.ok(!String(init?.body).includes('private-password'))
        assert.ok(!String(init?.body).includes('untrusted_screenpipe_evidence'))
      }
      // Missing workflow needs a real 404, rather than the proxy DB stub's generic error path.
      if (target.pathname.startsWith('/api/workflows/') && !saved.has(target.pathname.split('/').at(-1)!)) return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
      const response = await app.inject({ method: (init?.method || 'GET') as 'POST' | 'GET', url: target.pathname, ...(init?.body ? { payload: JSON.parse(String(init.body)) } : {}) })
      return new Response(response.body, { status: response.statusCode, headers: { 'Content-Type': 'application/json' } })
    }
    assert.equal(target.origin, config.url)
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${config.key}`)
    assert.equal(init?.redirect, 'error')
    if (mode === 'offline') throw new Error('secret error must not leak')
    if (mode === 'unauthorized') return Response.json({}, { status: 401 })
    if (target.pathname === '/activity-summary') return Response.json({ data_status: mode === 'empty' ? 'no_capture_in_range' : 'ok' })
    if (target.pathname === '/search') {
      searchCalls++
      assert.equal(target.searchParams.get('limit'), '20')
      assert.equal(Date.parse(target.searchParams.get('end_time')!) - Date.parse(target.searchParams.get('start_time')!), 86400000)
      if (mode === 'bad-search') return Response.json({ rows: [] })
      if (mode === 'out-of-range') return Response.json({ data: [{ type: 'OCR', content: { frame_id: 12, timestamp: '2000-01-01T00:00:00Z', text: 'ignored' } }] })
      return Response.json({ data: [{ type: 'OCR', content: { frame_id: 12, timestamp: target.searchParams.get('end_time'), app_name: 'Chrome', window_name: 'Payments', browser_url: evidence.url, text: 'Review invoice totals\npassword: private-password' } }] })
    }
    assert.equal(target.pathname, '/v1/local/chat/completions'); aiCalls++
    const body = JSON.parse(String(init?.body))
    assert.equal(body.messages[0].content, GHOST_SYSTEM_PROMPT)
    assert.equal(body.messages[2].content, expectedPrompt)
    assert.equal(body.stream, false); assert.equal(body.model, 'default')
    assert.ok(!JSON.stringify(body).includes('private-password'))
    assert.ok(!body.tools)
    if (mode === 'no-preset') return Response.json({}, { status: 400 })
    if (mode === 'unsupported-chat') return Response.json({}, { status: 404 })
    return Response.json({ choices: [{ finish_reason: mode === 'incomplete' ? 'length' : 'stop', message: { content: mode === 'bad-json' ? 'not JSON' : JSON.stringify(mode === 'invented' ? { ...output, steps: [{ ...step, evidenceIds: ['fake'] }] } : output) } }] })
  }
  try {
    await t.test('correct prompt, real provenance, staged progress and idempotent recovery', async () => {
      const request = { prompt: '  Find my payment workflow\n', timeRange: 'Last 24 hours' as const, requestId: randomUUID() }; expectedPrompt = request.prompt
      const stages: string[] = []
      const result = await discoverScreenpipeWorkflow(request, p => stages.push(p.phase), config)
      assert.equal(result.ok, true, JSON.stringify(result))
      assert.deepEqual(stages, ['activity', 'ai', 'saving'])
      assert.equal(saved.size, 1); assert.equal(saved.get(request.requestId).nodes[0].config.source, 'screenpipe')
      const previous = aiCalls
      assert.equal((await discoverScreenpipeWorkflow(request, undefined, config)).ok, true)
      assert.equal(aiCalls, previous)
      const conflict = await discoverScreenpipeWorkflow({ ...request, prompt: 'different task' }, undefined, config)
      assert.equal(conflict.ok, false)
    })
    for (const scenario of ['empty', 'offline', 'unauthorized', 'out-of-range', 'bad-search', 'no-preset', 'unsupported-chat', 'incomplete', 'bad-json', 'invented']) await t.test(scenario + ' never fabricates or saves a workflow', async () => {
      mode = scenario; const request = { prompt: '  Find my payment workflow\n', timeRange: 'Last 24 hours' as const, requestId: randomUUID() }; expectedPrompt = request.prompt
      const count = saved.size, previousAI = aiCalls
      const result = await discoverScreenpipeWorkflow(request, undefined, config)
      assert.equal(result.ok, false)
      if (!result.ok) assert.ok(!result.error.includes('Enter a request'), result.error)
      assert.equal(saved.size, count)
      assert.ok(!JSON.stringify(result).includes('secret error'))
      if (['empty', 'offline', 'unauthorized', 'out-of-range', 'bad-search'].includes(scenario)) assert.equal(aiCalls, previousAI)
    })
    assert.ok(searchCalls > 0); assert.ok(saves > 0)
    await t.test('new save endpoint is documented', async () => {
      const docs = (await app.inject('/docs/json')).json()
      assert.ok(docs.paths['/api/workflow-discovery/screenpipe'].post.requestBody)
    })
  } finally { globalThis.fetch = original; await app.close() }
})
