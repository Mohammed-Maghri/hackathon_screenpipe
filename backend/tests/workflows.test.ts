import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { buildApp } from '../src/app.js'
import { createDatabase } from '../src/database/client.js'
import { loadEnvironment } from '../src/config/env.js'

test('PostgreSQL migrations and workflow API integration', async t => {
  const env = loadEnvironment()
  const schema = `ghost_test_${randomUUID().replaceAll('-', '')}`
  const url = new URL(env.DATABASE_URL); url.searchParams.set('schema', schema)
  const admin = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 })
  await admin.connect()
  let app: Awaited<ReturnType<typeof buildApp>> | undefined
  try {
    // Only a random, test-owned schema is created/dropped. Never reset the configured schema.
    await admin.query(`CREATE SCHEMA "${schema}"`)
    const cli = (args: string[]) => execFileSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], { env: { ...process.env, DATABASE_URL: url.href }, stdio: 'pipe' })
    cli(['migrate', 'deploy']); cli(['migrate', 'deploy'])
    cli(['migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--exit-code'])
    const db = createDatabase(url.href)
    app = await buildApp({ ...env, DATABASE_URL: url.href, LOG_LEVEL: 'silent' }, db)
    const api = app
    let id = ''
    const nodeA = randomUUID(), nodeB = randomUUID(), edgeId = randomUUID()
    const graph = { nodes: [{ id: nodeA, type: 'TRIGGER', label: 'Start' }, { id: nodeB, type: 'ACTION', label: 'Action', config: { futureExecutor: 'local' } }], edges: [{ id: edgeId, sourceNodeId: nodeA, targetNodeId: nodeB }] }
    await t.test('health and configured CORS', async () => {
      const r = await api.inject({ url: '/health', headers: { origin: 'http://localhost:5173' } })
      assert.equal(r.statusCode, 200); assert.equal(r.json().database, 'up')
      assert.equal(r.headers['access-control-allow-origin'], 'http://localhost:5173')
      const denied = await api.inject({ url: '/health', headers: { origin: 'https://untrusted.example' } })
      assert.equal(denied.headers['access-control-allow-origin'], undefined)
    })
    await t.test('atomic create with graph, UUIDs and timestamps', async () => {
      const r = await api.inject({ method: 'POST', url: '/api/workflows', payload: { name: 'Test workflow', ...graph } })
      assert.equal(r.statusCode, 201, r.body); id = r.json().id
      assert.match(id, /^[0-9a-f-]{36}$/); assert.equal(r.json().nodes.length, 2)
      assert.equal(r.json().edges.length, 1); assert.ok(r.json().createdAt)
      assert.equal(r.headers.location, `/api/workflows/${id}`)
    })
    await t.test('get, filter, pagination and metadata patch', async () => {
      assert.equal((await api.inject(`/api/workflows/${id}`)).json().name, 'Test workflow')
      const patch = await api.inject({ method: 'PATCH', url: `/api/workflows/${id}`, payload: { name: 'Updated', status: 'ACTIVE' } })
      assert.equal(patch.statusCode, 200); assert.equal(patch.json().nodes.length, 2)
      const list = await api.inject('/api/workflows?status=ACTIVE&limit=1&offset=0')
      assert.equal(list.json().total, 1); assert.equal(list.json().items[0].name, 'Updated')
      assert.equal((await api.inject('/api/workflows?offset=1')).json().items.length, 0)
    })
    await t.test('invalid data, unknown fields, dangling and duplicate graph targets rejected', async () => {
      for (const payload of [{ name: '' }, { name: 'x', unknown: true }, { name: 'x', ...graph, edges: [{ ...graph.edges[0], targetNodeId: randomUUID() }] }, { name: 'x', nodes: [graph.nodes[0], graph.nodes[0]], edges: [] }]) {
        assert.equal((await api.inject({ method: 'POST', url: '/api/workflows', payload })).statusCode, 400)
      }
      for (const payload of [{}, { nodes: [] }]) assert.equal((await api.inject({ method: 'PATCH', url: `/api/workflows/${id}`, payload })).statusCode, 400)
      assert.equal((await api.inject('/api/workflows/not-a-uuid')).statusCode, 400)
      assert.equal((await api.inject('/api/workflows?limit=101')).statusCode, 400)
      assert.equal((await api.inject(`/api/workflows/${randomUUID()}`)).statusCode, 404)
      assert.equal((await api.inject({ method: 'POST', url: '/api/workflows', headers: { 'content-type': 'application/json' }, payload: '{' })).statusCode, 400)
    })
    await t.test('ownership FK and duplicate IDs roll back whole creation', async () => {
      assert.equal((await api.inject({ method: 'POST', url: '/api/workflows', payload: { name: 'bad owner', ownerId: randomUUID() } })).statusCode, 409)
      assert.equal((await api.inject({ method: 'POST', url: '/api/workflows', payload: { name: 'collision', ...graph } })).statusCode, 409)
      assert.equal(await db.workflow.count(), 1)
    })
    await t.test('graph replacement and failed update are atomic', async () => {
      const r = await api.inject({ method: 'PATCH', url: `/api/workflows/${id}`, payload: { ...graph, nodes: graph.nodes.map(n => ({ ...n, label: 'Changed' })) } })
      assert.equal(r.statusCode, 200)
      const other = await db.workflow.create({ data: { name: 'other', nodes: { create: { id: randomUUID(), type: 'ACTION', label: 'Other' } } }, include: { nodes: true } })
      const failure = await api.inject({ method: 'PATCH', url: `/api/workflows/${id}`, payload: { name: 'Should roll back', nodes: [{ id: other.nodes[0]!.id, label: 'Collision', type: 'ACTION' }], edges: [] } })
      assert.equal(failure.statusCode, 409)
      const current = (await api.inject(`/api/workflows/${id}`)).json()
      assert.equal(current.name, 'Updated'); assert.equal(current.edges.length, 1)
      await db.workflow.delete({ where: { id: other.id } })
    })
    await t.test('run relationships, history protection and cascading delete', async () => {
      const run = await db.workflowRun.create({ data: { workflowId: id } })
      await db.nodeRun.create({ data: { workflowId: id, workflowRunId: run.id, nodeId: nodeA } })
      assert.equal((await api.inject({ method: 'PATCH', url: `/api/workflows/${id}`, payload: { nodes: [], edges: [] } })).statusCode, 409)
      assert.equal((await api.inject({ method: 'DELETE', url: `/api/workflows/${id}` })).statusCode, 204)
      assert.equal(await db.workflowNode.count(), 0); assert.equal(await db.workflowEdge.count(), 0)
      assert.equal(await db.workflowRun.count(), 0); assert.equal(await db.nodeRun.count(), 0)
      assert.equal((await api.inject({ method: 'DELETE', url: `/api/workflows/${id}` })).statusCode, 404)
    })
    await t.test('database constraints reject cross-workflow edges and node runs', async () => {
      const a = await db.workflow.create({ data: { name: 'A', nodes: { create: { type: 'ACTION', label: 'A' } } }, include: { nodes: true } })
      const b = await db.workflow.create({ data: { name: 'B', nodes: { create: { type: 'ACTION', label: 'B' } } }, include: { nodes: true } })
      await assert.rejects(db.workflowEdge.create({ data: { workflowId: a.id, sourceNodeId: a.nodes[0]!.id, targetNodeId: b.nodes[0]!.id } }))
      const run = await db.workflowRun.create({ data: { workflowId: a.id } })
      await assert.rejects(db.nodeRun.create({ data: { workflowId: a.id, workflowRunId: run.id, nodeId: b.nodes[0]!.id } }))
    })
    await t.test('generated board persists, reopens and retries without duplicate writes', async () => {
      const { generateAndSave } = await import('../src/modules/discovery/discovery.generate.js')
      const { WorkflowService } = await import('../src/modules/workflows/workflow.service.js')
      const original = globalThis.fetch
      let calls = 0
      globalThis.fetch = async () => { calls++; return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ name: 'Generated test', description: 'Mock evidence', steps: [{ name: 'Review', description: 'Review mock updates', evidenceId: 'sim_obs_1', application: 'Slack', type: 'browser' as const, startUrl: null, missingInformation: [] }] }) }] }] }) }
      try {
        const requestId = randomUUID(), service = new WorkflowService(db)
        const first = await generateAndSave(service, 'Review', requestId, { apiKey: 'test-only' })
        const second = await generateAndSave(service, 'Review', requestId, { apiKey: 'test-only' })
        assert.equal(first.id, requestId); assert.equal(second.id, requestId); assert.equal(calls, 1)
        const loaded = (await api.inject(`/api/workflows/${requestId}`)).json()
        assert.equal(loaded.nodes.length, 1); assert.equal(loaded.nodes[0].config.source, 'development_mock')
        const patch = await api.inject({ method: 'PATCH', url: `/api/workflows/${requestId}`, payload: { name: 'Edited board' } })
        assert.equal(patch.statusCode, 200); assert.equal((await api.inject(`/api/workflows/${requestId}`)).json().name, 'Edited board')
      } finally { globalThis.fetch = original }
    })
    await t.test('workflow library searches persisted drafts and filters with pagination', async () => {
      const response = await api.inject({ method: 'POST', url: '/api/workflows', payload: { name: 'Library unique draft', description: 'Quarterly invoice review' } })
      assert.equal(response.statusCode, 201)
      const draft = response.json()
      assert.equal(draft.status, 'DRAFT'); assert.deepEqual(draft.nodes, [])
      const result = (await api.inject('/api/workflows?search=QUARTERLY&status=DRAFT&limit=1')).json()
      assert.equal(result.total, 1); assert.equal(result.items[0].id, draft.id)
      assert.deepEqual(result.items[0].applicationIcons, [])
      assert.equal((await api.inject('/api/workflows?search=QUARTERLY&status=ACTIVE')).json().total, 0)
      assert.equal((await api.inject('/api/workflows?search=QUARTERLY&offset=1')).json().items.length, 0)
      assert.equal((await api.inject('/api/workflows?search=' + 'a'.repeat(201))).statusCode, 400)
      await api.inject({ method: 'DELETE', url: '/api/workflows/' + draft.id })
    })
    await t.test('health returns 503 when database fails without leaking connection details', async () => {
      const original = db.$queryRaw
      db.$queryRaw = (() => Promise.reject(new Error('private database detail'))) as typeof db.$queryRaw
      try { const r = await api.inject('/health'); assert.equal(r.statusCode, 503); assert.ok(!r.body.includes('private')) }
      finally { db.$queryRaw = original }
    })
  } finally {
    await app?.close()
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`)
    await admin.end()
  }
})
