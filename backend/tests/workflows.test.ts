import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { build } from 'esbuild'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
    app = await buildApp({ ...env, DATABASE_URL: url.href, LOG_LEVEL: 'silent', OPENAI_API_KEY: 'test-only' }, db)
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
    await t.test('encrypted credential storage, authorization, isolation and deletion', async () => {
      const token = randomBytes(32).toString('hex')
      const headers = { authorization: `Bearer ${token}` }
      const payload = { version: 1, iv: randomBytes(12).toString('base64'), tag: randomBytes(16).toString('base64'), data: randomBytes(32).toString('base64') }
      assert.equal((await api.inject('/api/recording-secrets')).statusCode, 401)
      assert.equal((await api.inject({ method: 'POST', url: '/api/recording-secrets', headers, payload: { password: 'must-not-be-stored' } })).statusCode, 400)
      assert.equal((await api.inject({ method: 'POST', url: '/api/recording-secrets', headers, payload })).statusCode, 200)
      const stored = await db.recordingSecret.findUniqueOrThrow({ where: { id: createHash('sha256').update(token).digest('hex') } })
      assert.deepEqual(stored.payload, payload)
      assert.ok(!JSON.stringify(stored).includes(token))
      assert.equal((await api.inject({ url: '/api/recording-secrets', headers: { authorization: `Bearer ${randomBytes(32).toString('hex')}` } })).statusCode, 404)
      const fetched = await api.inject({ url: '/api/recording-secrets', headers })
      assert.deepEqual(fetched.json(), payload)
      assert.equal(fetched.headers['cache-control'], 'no-store')
      assert.equal((await api.inject({ method: 'DELETE', url: '/api/recording-secrets', headers })).statusCode, 204)
      assert.equal((await api.inject({ url: '/api/recording-secrets', headers })).statusCode, 404)
    })
    await t.test('desktop passwords round-trip through PostgreSQL and restore without re-entry', async () => {
      const bundle = await build({ entryPoints: ['../src/main/recordingStore.ts'], bundle: true, write: false, platform: 'node', format: 'esm' })
      const { RecordingStore } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0]!.text).toString('base64'))
      const root = await mkdtemp(join(tmpdir(), 'ghost-backend-secrets-'))
      const previous = process.env.GHOST_BACKEND_URL
      process.env.GHOST_BACKEND_URL = await api.listen({ host: '127.0.0.1', port: 0 })
      try {
        const recording = new RecordingStore(root, 'test-workflow', 'test-login')
        const event = recording.append('input', 'https://example.test/login', { target: { selector: '#password', credential: true }, value: '[ENCRYPTED]', secretValue: 'persistent-test-password' })
        recording.append('input', 'https://example.test/login', { target: { selector: '#email' }, value: 'server@example.test' })
        assert.equal((await recording.stop(true)).secretSync, 'saved')
        assert.equal(await db.recordingSecret.count(), 1)
        assert.ok(!JSON.stringify(await db.recordingSecret.findMany()).includes('persistent-test-password'))
        // Save a changed password, then remove both local ciphertext copies.
        await writeFile(join(recording.directory, 'inputs.json'), JSON.stringify([{ sequence: event.sequence, label: 'Password', value: '', secret: true, encryptedValue: recording.encryptInput(event, 'updated-test-password') }]))
        assert.equal((await recording.syncSecrets()).secretSync, 'saved')
        const captured = (await readFile(recording.eventsPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
        delete captured[0].data.encryptedValue
        captured[1].data.value = 'stale-local@example.test'
        await writeFile(recording.eventsPath, captured.map(event => JSON.stringify(event)).join('\n') + '\n')
        await writeFile(join(recording.directory, 'inputs.json'), '[]')
        const restored = await RecordingStore.restore(root, 'test-workflow', 'test-login')
        const recovered = await restored.replayData()
        assert.equal(recovered.inputSource, 'backend')
        assert.equal(recovered.events[1].data.value, 'server@example.test')
        assert.equal(restored.decryptInput(recovered.events[0]), 'persistent-test-password')
        assert.equal(restored.decryptInput({ ...recovered.events[0], data: { encryptedValue: recovered.inputs[0].encryptedValue } }), 'updated-test-password')
        assert.equal(restored.status().secretSync, 'saved')
        await restored.stop(true)
        assert.equal((await restored.replayData()).events[1].data.value, 'server@example.test', 'Closing a restored recording must not overwrite server inputs')
        // Another installation cannot fetch this recording with a different key.
        const other = new RecordingStore(join(root, 'other-device'), 'test-workflow', 'test-login')
        assert.equal((await other.replayData()).events.length, 0)
        await db.recordingSecret.deleteMany()
      } finally {
        if (previous === undefined) delete process.env.GHOST_BACKEND_URL; else process.env.GHOST_BACKEND_URL = previous
        await rm(root, { recursive: true, force: true })
      }
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
    await t.test('local data processing contracts persist and invalid mappings are rejected', async () => {
      const source = randomUUID(), processor = randomUUID(), edge = randomUUID()
      const processing = { version: 1, operation: 'merge_files', inputs: { files: { nodeId: source, output: 'files', type: 'files' } }, rules: {} }
      const nodes = [
        { id: source, type: 'ACTION', label: 'Download reports', config: { stepType: 'browser', status: 'learned' } },
        { id: processor, type: 'TRANSFORM', label: 'Merge reports', config: { stepType: 'data_processing', status: 'ready', dataProcessing: processing } },
      ]
      const edges = [{ id: edge, sourceNodeId: source, targetNodeId: processor }]
      const created = await api.inject({ method: 'POST', url: '/api/workflows', payload: { name: 'Local report processing', nodes, edges } })
      assert.equal(created.statusCode, 201, created.body)
      const workflowId = created.json().id
      try {
        const restored = (await api.inject(`/api/workflows/${workflowId}`)).json()
        const saved = restored.nodes.find((n: { id: string }) => n.id === processor)
        assert.equal(saved.type, 'TRANSFORM')
        assert.equal(saved.config.executor, 'local')
        assert.equal(saved.config.modelTask, null)
        assert.deepEqual(saved.config.dataProcessing, processing)
        const changed = structuredClone(nodes)
        changed[1]!.config.dataProcessing!.inputs.files.type = 'rows'
        const invalid = await api.inject({ method: 'PATCH', url: `/api/workflows/${workflowId}`, payload: { nodes: changed, edges } })
        assert.equal(invalid.statusCode, 400, invalid.body)
        assert.deepEqual((await api.inject(`/api/workflows/${workflowId}`)).json().nodes.find((n: { id: string }) => n.id === processor).config.dataProcessing, processing)
        const disconnected = await api.inject({ method: 'PATCH', url: `/api/workflows/${workflowId}`, payload: { nodes, edges: [] } })
        assert.equal(disconnected.statusCode, 400)
        const draft = structuredClone(nodes)
        draft[1]!.config.status = 'needs_configuration'
        draft[1]!.config.dataProcessing!.inputs = {} as typeof processing.inputs
        assert.equal((await api.inject({ method: 'PATCH', url: `/api/workflows/${workflowId}`, payload: { nodes: draft, edges } })).statusCode, 200)
      } finally { await api.inject({ method: 'DELETE', url: `/api/workflows/${workflowId}` }) }
    })
    await t.test('runtime draft and approved versions persist through Prisma without replacing run history', async () => {
      const source=randomUUID(), processor=randomUUID()
      const created=await api.inject({method:'POST',url:'/api/workflows',payload:{name:'Runtime approval persistence',nodes:[
        {id:source,type:'ACTION',label:'Downloads',config:{stepType:'browser'}},
        {id:processor,type:'TRANSFORM',label:'Filter',config:{stepType:'data_processing',description:'Keep status Failed.',status:'needs_configuration',dataProcessing:{version:1,mode:'generated',operation:'read_files',inputs:{files:{nodeId:source,output:'files',type:'files'}},rules:{},expectedOutput:{format:'rows',filename:null}}}}
      ],edges:[{id:randomUUID(),sourceNodeId:source,targetNodeId:processor}]}})
      assert.equal(created.statusCode,201,created.body)
      const workflowId=created.json().id, original=globalThis.fetch
      const plan={version:1,steps:[{id:'failed',type:'filter',source:'files_0',column:'status',operator:'eq',value:'Failed'}]}
      globalThis.fetch=async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({status:'needs_review',reason:'',plan})}]}]})
      try {
        const run=await db.workflowRun.create({data:{workflowId}})
        const nodeRun=await db.nodeRun.create({data:{workflowId,workflowRunId:run.id,nodeId:processor}})
        const request={workflowId,nodeId:processor,inputSchema:{version:1,datasets:[{id:'files_0',input:'files',format:'xlsx',sheet:'Reports',fields:[{name:'status',types:['string'],nullCount:0}],rowCount:1,samples:[],structure:null}],warnings:[]},consent:{schema:true,samples:false}}
        const generated=await api.inject({method:'POST',url:'/api/workflows/nodes/generate-logic',payload:request})
        assert.equal(generated.statusCode,200,generated.body)
        const draft=generated.json().draft
        const stored=await db.workflowNode.findUniqueOrThrow({where:{id:processor}})
        assert.equal((stored.config as any).logicDraft.fingerprint,draft.fingerprint)
        const approved=await api.inject({method:'POST',url:'/api/workflows/nodes/approve-logic',payload:{workflowId,nodeId:processor,plan,testId:randomUUID(),fingerprint:draft.fingerprint,bindingHash:draft.bindingHash,objective:draft.objective,version:draft.version}})
        assert.equal(approved.statusCode,200,approved.body)
        const reopened=(await api.inject(`/api/workflows/${workflowId}`)).json().nodes.find((n:any)=>n.id===processor)
        assert.deepEqual(reopened.config.dataProcessing.approvedPlan.plan,plan)
        assert.equal(reopened.config.dataProcessing.approvedPlan.version,1)
        assert.equal(reopened.config.logicDraft,null)
        assert.ok(await db.nodeRun.findUnique({where:{id:nodeRun.id}}))
        const next=await api.inject({method:'POST',url:'/api/workflows/nodes/generate-logic',payload:request})
        assert.equal(next.json().draft.version,2)
        assert.equal(((await db.workflowNode.findUniqueOrThrow({where:{id:processor}})).config as any).dataProcessing.approvedPlan.version,1)
      } finally {globalThis.fetch=original;await api.inject({method:'DELETE',url:`/api/workflows/${workflowId}`})}
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
      globalThis.fetch = async () => { calls++; return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ name: 'Generated test', description: 'Mock evidence', steps: [{ name: 'Review', description: 'Review mock updates', evidenceId: 'sim_obs_1', application: 'Slack', type: 'browser' as const, startUrl: null, contract: null, missingInformation: [] }] }) }] }] }) }
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
    await t.test('define input/output endpoint persists bindings and refreshes model instructions after edits', async () => {
      const sourceId = randomUUID(), filterId = randomUUID()
      const field = { name: 'text', type: 'string', description: 'Extracted request text', required: true, itemType: null, fields: [] }
      const sourceContract = { inputs: [], outputs: [field], validationCriteria: ['Text is present'], requiresHumanReview: false }
      const logicContract = { inputs: [{ ...field, sourceStepId: sourceId, sourceOutput: 'text' }], outputs: [{ ...field, name: 'summary' }], validationCriteria: ['Summary matches source facts'], requiresHumanReview: false }
      const created = (await api.inject({ method: 'POST', url: '/api/workflows', payload: { name: 'Typed contract workflow', nodes: [{ id: sourceId, type: 'ACTION', label: 'Collect', config: { stepType: 'browser', description: 'Collect text' } }, { id: filterId, type: 'ACTION', label: 'Summarize', config: { stepType: 'application', description: 'Summarize unresolved requests' } }], edges: [{ id: randomUUID(), sourceNodeId: sourceId, targetNodeId: filterId }] } })).json()
      const original = globalThis.fetch
      globalThis.fetch = async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ nodes: [{ id: sourceId, stepType: 'browser', contract: sourceContract }, { id: filterId, stepType: 'logic', contract: logicContract }] }) }] }] })
      try {
        const response = await api.inject({ method: 'POST', url: `/api/workflows/${created.id}/contracts` })
        assert.equal(response.statusCode, 200, response.body)
        const loaded = (await api.inject(`/api/workflows/${created.id}`)).json()
        const filter = loaded.nodes.find((node: any) => node.id === filterId)
        assert.equal(filter.type, 'TRANSFORM')
        assert.equal(filter.config.contract.inputs[0].sourceStepId, sourceId)
        assert.equal(filter.config.modelTask.instructions, 'Summarize unresolved requests')
        filter.config.description = 'Summarize only urgent unresolved requests'
        const payload = { nodes: loaded.nodes.map(({ id, type, label, positionX, positionY, config }: any) => ({ id, type, label, positionX, positionY, config })), edges: loaded.edges.map(({ id, sourceNodeId, targetNodeId, label }: any) => ({ id, sourceNodeId, targetNodeId, label })) }
        const saved = await api.inject({ method: 'PATCH', url: `/api/workflows/${created.id}`, payload })
        assert.equal(saved.statusCode, 200, saved.body)
        assert.equal(saved.json().nodes.find((node: any) => node.id === filterId).config.modelTask.instructions, filter.config.description)
        filter.config.contract.inputs[0].sourceStepId = randomUUID()
        assert.equal((await api.inject({ method: 'PATCH', url: `/api/workflows/${created.id}`, payload })).statusCode, 400)
      } finally { globalThis.fetch = original }
    })
    await t.test('real Screenpipe graph persists references and retries without duplicate writes', async () => {
      const requestId = randomUUID()
      const payload = { requestId, prompt: 'Find invoice review', timeRange: 'Last 24 hours', startTime: '2026-10-16T00:00:00.000Z', endTime: '2026-10-17T00:00:00.000Z', truncated: true,
        evidence: [{ id: 'screenpipe:frame:7', type: 'frame', sourceId: 7, timestamp: '2026-10-16T12:00:00.000Z', application: 'Chrome', windowName: 'Invoices', url: 'https://example.com/invoices' }],
        output: { workflow: { name: 'Recorded invoice review', description: 'Review invoices' }, missingInformation: [], steps: [{ id: 'step_1', name: 'Review invoices', description: 'Review invoice totals', application: 'Chrome', type: 'browser', status: 'needs_recording', startUrl: 'https://example.com/invoices', websiteUrl: null, domain: null, pageNames: ['Invoices'], basis: 'observed', expectedOutcome: null, contract: null, evidenceIds: ['screenpipe:frame:7'], missingInformation: [] }] },
      }
      const result = await api.inject({ method: 'POST', url: '/api/workflow-discovery/screenpipe', payload })
      assert.equal(result.statusCode, 200, result.body)
      const fetched = (await api.inject('/api/workflows/' + requestId)).json()
      assert.equal(fetched.nodes[0].config.source, 'screenpipe')
      assert.equal(fetched.nodes[0].config.evidence[0].sourceId, 7)
      assert.equal(fetched.nodes[0].config.status, 'needs_recording')
      const retried = await api.inject({ method: 'POST', url: '/api/workflow-discovery/screenpipe', payload })
      assert.equal(retried.statusCode, 200); assert.equal(retried.json().nodes[0].id, fetched.nodes[0].id)
      assert.equal((await api.inject({ method: 'POST', url: '/api/workflow-discovery/screenpipe', payload: { ...payload, prompt: 'Different request' } })).statusCode, 409)
      await api.inject({ method: 'DELETE', url: '/api/workflows/' + requestId })
    })
    await t.test('Pipe final answer persists unverified references and retries idempotently', async () => {
      const requestId = randomUUID()
      const payload = { requestId, prompt: 'Find my report', timeRange: 'Last 7 days', pipeId: 'ghost-workflow-discovery', executionId: 42,
        result: { requestId, workflow: { name: 'Pipe report', description: 'Reported workflow' }, missingInformation: [], steps: [
          { id: 'step_1', name: 'Review', description: 'Review metrics', application: 'Chrome', type: 'browser', startUrl: null, basis: 'observed', references: ['screenpipe://frame/42'], missingInformation: [] },
        ] },
      }
      const created = await api.inject({ method: 'POST', url: '/api/workflow-discovery/screenpipe-agent', payload })
      assert.equal(created.statusCode, 200, created.body)
      const retrieved = (await api.inject({ url: `/api/workflows/${requestId}` })).json()
      assert.equal(retrieved.nodes[0].config.referencesVerified, false)
      assert.deepEqual(retrieved.nodes[0].config.evidenceIds, [])
      assert.deepEqual(retrieved.nodes[0].config.sourceReferences, ['screenpipe://frame/42'])
      const retry = await api.inject({ method: 'POST', url: '/api/workflow-discovery/screenpipe-agent', payload })
      assert.equal(retry.json().nodes[0].id, retrieved.nodes[0].id)
      assert.equal((await api.inject({ method: 'POST', url: '/api/workflow-discovery/screenpipe-agent', payload: { ...payload, prompt: 'Another request' } })).statusCode, 409)
      await api.inject({ method: 'DELETE', url: `/api/workflows/${requestId}` })
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
