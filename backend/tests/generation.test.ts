import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app.js'
import type { Database } from '../src/database/client.js'
import { generateDescription, buildGeneratedGraph } from '../src/modules/discovery/discovery.generate.js'
const description = { name: 'Daily reporting', description: 'Review reporting data', steps: [
  { name: 'Review Slack', description: 'Review daily updates', evidenceId: 'sim_obs_1' as const, application: 'Slack', type: 'browser' as const, startUrl: null, contract: null, missingInformation: [] },
  { name: 'Check metrics', description: 'Review metrics', evidenceId: 'sim_obs_2' as const, application: 'Company Dashboard', type: 'browser' as const, startUrl: null, contract: null, missingInformation: [] },
  { name: 'Prepare report', description: 'Prepare a spreadsheet', evidenceId: 'sim_obs_3' as const, application: 'Excel', type: 'application' as const, startUrl: null, contract: null, missingInformation: [] },
] }
test('AI contract, safe graph conversion and failures', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      assert.equal(body.input.length, 1); assert.match(body.instructions, /simulator/); assert.ok(!JSON.stringify(body.input).includes('Daily reporting')); assert.equal(body.store, false); assert.equal(body.text.format.strict, true)
      assert.equal(body.input[0].content, '  Original request  ')
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(description) }] }] })
    }
    const result = await generateDescription('  Original request  ', { apiKey: 'test-only' })
    const graph = buildGeneratedGraph(result, '40000000-0000-4000-8000-000000000001')
    assert.equal(graph.nodes.length, 2); assert.equal(graph.edges.length, 1)
    assert.deepEqual(graph.nodes.map(node => node.config.status), ['needs_recording', 'needs_configuration'])
    assert.equal(graph.nodes[0]!.config.startUrl, null)
    assert.deepEqual(graph.nodes[0]!.config.evidenceIds, ['sim_obs_1', 'sim_obs_2'])
    assert.match(String(graph.nodes[0]!.config.description), /Review daily updates/)
    assert.match(String(graph.nodes[0]!.config.description), /Review metrics/)
    assert.equal(graph.nodes[0]!.config.recordingScope, 'browser_session')
    const ordered = buildGeneratedGraph({ ...description, steps: [{ ...description.steps[0]!, startUrl: 'https://example.com/dashboard' }, description.steps[1]!, description.steps[2]!, { ...description.steps[0]!, evidenceId: 'sim_obs_4' }] }, '40000000-0000-4000-8000-000000000001')
    assert.equal(ordered.nodes.length, 3)
    assert.equal(ordered.nodes[0]!.config.startUrl, 'https://example.com/dashboard')
    assert.equal(ordered.nodes[2]!.config.startUrl, null)
    assert.ok(graph.nodes.every(node => node.config.source === 'development_mock'))
    await assert.rejects(generateDescription('test', {}), /OPENAI_API_KEY/)
    globalThis.fetch = async () => Response.json({ secret: 'must never reach client' }, { status: 401 })
    await assert.rejects(generateDescription('test', { apiKey: 'test-only' }), /Check the backend API key/)
    for (const invalid of [{ ...description, steps: [{ ...description.steps[0], selector: '#button' }] }, { ...description, steps: [description.steps[0], description.steps[0]] }]) {
      globalThis.fetch = async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(invalid) }] }] })
      await assert.rejects(generateDescription('test', { apiKey: 'test-only' }), /invalid workflow/)
    }
  } finally { globalThis.fetch = original }
})
test('mock waits five seconds and production rejects both development endpoints', async () => {
  const db = { $disconnect: async () => {} } as Database
  const env = { NODE_ENV: 'test' as const, HOST: '127.0.0.1', PORT: 3001, LOG_LEVEL: 'silent' as const, DATABASE_URL: 'postgresql://unused:unused@localhost/unused', CORS_ORIGINS: [] }
  const app = await buildApp(env, db)
  try {
    const started = performance.now()
    const result = await app.inject({ method: 'POST', url: '/api/workflow-discovery/mock', payload: { prompt: 'Report' } })
    assert.equal(result.statusCode, 200); assert.ok(performance.now() - started >= 4950)
    assert.equal(result.json().source, 'development_mock'); assert.equal(result.json().simulator, 'openai'); assert.equal(result.json().observations, undefined)
  } finally { await app.close() }
  const production = await buildApp({ ...env, NODE_ENV: 'production' }, db)
  try {
    for (const endpoint of ['mock', 'generate']) assert.equal((await production.inject({ method: 'POST', url: `/api/workflow-discovery/${endpoint}`, payload: { prompt: 'Report' } })).statusCode, 403)
  } finally { await production.close() }
})
