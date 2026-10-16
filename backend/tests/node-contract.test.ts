import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGeneratedGraph, generatedDescriptionSchema } from '../src/modules/discovery/discovery.generate.js'
import { buildNodeModelTask, configureNodeContracts, type NodeContract } from '../src/modules/workflows/node-contract.js'
import { defineWorkflowContracts } from '../src/modules/workflows/node-contract.generate.js'
import type { WorkflowService } from '../src/modules/workflows/workflow.service.js'

const row = { name: 'rows', type: 'array' as const, itemType: 'object' as const, description: 'Requests with stable IDs and status', required: true, fields: [
  { name: 'id', type: 'string' as const, description: 'Original request ID', required: true },
  { name: 'status', type: 'string' as const, description: 'Request status', required: true },
] }
const browser: NodeContract = { inputs: [], outputs: [row], validationCriteria: ['Every exported row has an ID.'], requiresHumanReview: false }
const filter: NodeContract = { inputs: [{ ...row, sourceStepId: 'sim_obs_1', sourceOutput: 'rows' }], outputs: [{ ...row, name: 'filteredRows' }], validationCriteria: ['Only unresolved requests remain.', 'Preserve the original IDs.'], requiresHumanReview: false }
const description = { name: 'Filter requests', description: 'Collect, filter and approve requests', steps: [
  { name: 'Export requests', description: 'Collect request rows', application: 'Browser', type: 'browser' as const, startUrl: null, contract: browser, evidenceId: 'sim_obs_1', missingInformation: [] },
  { name: 'Filter requests', description: 'Keep only unresolved requests', application: 'OpenAI', type: 'logic' as const, startUrl: null, contract: filter, evidenceId: 'sim_obs_2', missingInformation: [] },
  { name: 'Approve requests', description: 'Human approves filtered requests', application: 'Ghost', type: 'review' as const, startUrl: null, contract: { ...filter, inputs: [{ ...row, sourceStepId: 'sim_obs_2', sourceOutput: 'filteredRows' }], requiresHumanReview: true }, evidenceId: 'sim_obs_3', missingInformation: [] },
] }

test('generated logic/review nodes retain typed data bindings and validation', () => {
  const graph = buildGeneratedGraph(generatedDescriptionSchema.parse(description), '40000000-0000-4000-8000-000000000001')
  assert.deepEqual(graph.nodes.map(node => node.type), ['ACTION', 'TRANSFORM', 'CONDITION'])
  const input = (graph.nodes[1]!.config.contract as unknown as NodeContract).inputs[0]!
  assert.equal(input.sourceStepId, graph.nodes[0]!.id)
  assert.equal(input.sourceOutput, 'rows')
  assert.equal((graph.nodes[2]!.config.contract as unknown as NodeContract).requiresHumanReview, true)
  const task = graph.nodes[1]!.config.modelTask as any
  assert.equal(task.instructions, description.steps[1]!.description)
  assert.deepEqual(task.outputSchema.required, ['filteredRows'])
  assert.equal(task.outputSchema.properties.filteredRows.items.properties.id.type, 'string')
  assert.deepEqual(task.validationCriteria, filter.validationCriteria)
  assert.ok(configureNodeContracts(graph.nodes, graph.edges))
})

test('invalid sources, mismatched fields and missing human approval are rejected', () => {
  for (const change of [
    { ...filter, inputs: [{ ...filter.inputs[0]!, sourceStepId: 'sim_obs_3' }] },
    { ...filter, inputs: [{ ...filter.inputs[0]!, sourceOutput: 'missing' }] },
    { ...filter, inputs: [{ ...filter.inputs[0]!, type: 'string' as const, itemType: null, fields: [] }] },
    { ...filter, outputs: [] },
  ]) assert.throws(() => buildGeneratedGraph({ ...description, steps: [description.steps[0]!, { ...description.steps[1]!, contract: change }] }, '40000000-0000-4000-8000-000000000001'))
  assert.throws(() => buildGeneratedGraph({ ...description, steps: [description.steps[0]!, description.steps[1]!, { ...description.steps[2]!, contract: { ...description.steps[2]!.contract, requiresHumanReview: false } }] }, '40000000-0000-4000-8000-000000000001'))
  const task = buildNodeModelTask('Summarize', { inputs: [], outputs: [{ name: 'summary', type: 'string', required: false, description: 'Optional summary', fields: [], itemType: null }], validationCriteria: [], requiresHumanReview: false })
  assert.deepEqual((task.outputSchema.properties.summary as any).anyOf, [{ type: 'string' }, { type: 'null' }])
})

test('existing workflow contracts use node descriptions, preserve recordings and reject invalid/concurrent changes', async () => {
  const graph = buildGeneratedGraph(description, '40000000-0000-4000-8000-000000000001')
  const date = new Date('2026-10-13T00:00:00Z')
  let saves = 0, concurrent = false, reads = 0
  const workflow = { ...graph, id: '40000000-0000-4000-8000-000000000001', updatedAt: date }
  const service = { get: async () => ({ ...workflow, updatedAt: concurrent && reads++ > 0 ? new Date(date.getTime() + 1) : date }), update: async (_id: string, data: unknown, version: Date) => { saves++; assert.equal(version, date); return data } } as unknown as WorkflowService
  let response = { nodes: graph.nodes.map(node => ({ id: node.id, stepType: node.config.stepType, contract: node.config.contract })) }
  const original = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body))
    assert.equal(body.store, false)
    assert.equal(JSON.parse(body.input[0].content).nodes[1].description, 'Keep only unresolved requests')
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(response) }] }] })
  }
  try {
    await defineWorkflowContracts(service, workflow.id, { apiKey: 'test-only' })
    assert.equal(saves, 1)
    concurrent = true; reads = 0
    await assert.rejects(defineWorkflowContracts(service, workflow.id, { apiKey: 'test-only' }), /changed/)
    assert.equal(saves, 1)
    concurrent = false
    response = { nodes: response.nodes.slice(1) }
    await assert.rejects(defineWorkflowContracts(service, workflow.id, { apiKey: 'test-only' }), /Invalid node contracts/)
    assert.equal(saves, 1)
  } finally { globalThis.fetch = original }
})


test('only previous-output processing is AI; Excel download, application action and approval keep their executors', () => {
  const file = { name: 'workbook', type: 'file' as const, itemType: null, fields: [], required: true, description: 'Excel workbook downloaded by the browser' }
  const dataContract = { inputs: [], outputs: [file], validationCriteria: ['Workbook download completed'], requiresHumanReview: false }
  const parseContract = { ...filter, inputs: [{ ...file, sourceStepId: 'download', sourceOutput: 'workbook' }] }
  const nodes = configureNodeContracts<{ id: string; config: Record<string, any> }>([
    { id: 'download', config: { stepType: 'browser', description: 'Download the Excel workbook', contract: dataContract, modelTask: { stale: true } } },
    { id: 'parse', config: { stepType: 'logic', description: 'Check the downloaded workbook and keep unresolved requests', contract: parseContract } },
    { id: 'save', config: { stepType: 'application', description: 'Save the output file', modelTask: { stale: true } } },
    { id: 'approve', config: { stepType: 'review', description: 'Human approves the checked rows', contract: { ...filter, inputs: [{ ...row, sourceStepId: 'parse', sourceOutput: 'filteredRows' }], requiresHumanReview: true } } },
  ], [{ sourceNodeId: 'download', targetNodeId: 'parse' }, { sourceNodeId: 'parse', targetNodeId: 'save' }, { sourceNodeId: 'save', targetNodeId: 'approve' }])
  assert.deepEqual(nodes.map(node => node.config.executor), ['recording', 'ai', 'application', 'human'])
  assert.deepEqual(nodes.filter(node => node.config.modelTask).map(node => node.id), ['parse'])
  assert.equal(nodes[1]!.config.modelTask!.inputPreparation[0]!.mode, 'parse_artifact_contents')
  const standalone = { ...parseContract, inputs: [{ ...file, sourceStepId: null, sourceOutput: null }] }
  assert.throws(() => configureNodeContracts([{ id: 'alone', config: { stepType: 'logic', contract: standalone } }], []), /previous node/)
})
