// Opt-in live OpenAI contract check; no workflow is written to the database.
import assert from 'node:assert/strict'
import { loadEnvironment } from '../src/config/env.js'
import { defineWorkflowContracts } from '../src/modules/workflows/node-contract.generate.js'
import type { WorkflowService } from '../src/modules/workflows/workflow.service.js'
const env = loadEnvironment()
const ids = ['40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003']
const workflow = { id: '40000000-0000-4000-8000-000000000000', updatedAt: new Date(), nodes: [
  { id: ids[0], type: 'ACTION', label: 'Collect requests', positionX: 0, positionY: 0, config: { stepType: 'browser', description: 'Use the recorded browser session to export request rows with id (string), status (string), and priority (string).' } },
  { id: ids[1], type: 'ACTION', label: 'Filter requests', positionX: 290, positionY: 0, config: { stepType: 'application', description: 'Filter the exported request rows to status=open and priority=urgent. Preserve original IDs. Return matching rows and an excluded count.' } },
  { id: ids[2], type: 'ACTION', label: 'Review requests', positionX: 580, positionY: 0, config: { stepType: 'application', description: 'Ask a human to approve or reject the filtered requests. Output the human decision and approved rows. Do not continue before approval.' } },
], edges: [{ id: '50000000-0000-4000-8000-000000000001', sourceNodeId: ids[0], targetNodeId: ids[1], label: null }, { id: '50000000-0000-4000-8000-000000000002', sourceNodeId: ids[1], targetNodeId: ids[2], label: null }] }
let saved: any
const service = { get: async () => workflow, update: async (_id: string, value: any) => { saved = value; return value } } as unknown as WorkflowService
await defineWorkflowContracts(service, workflow.id, { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL })
console.log('Live contract classifications:', saved.nodes.map((node: any) => ({ name: node.label, type: node.config.stepType, inputs: node.config.contract?.inputs.length, outputs: node.config.contract?.outputs.length })))
assert.deepEqual(saved.nodes.map((node: any) => node.config.stepType), ['browser', 'logic', 'review'])
assert.equal(saved.nodes[1].config.contract.inputs[0].sourceStepId, ids[0])
assert.equal(saved.nodes[2].config.contract.requiresHumanReview, true)
assert.ok(saved.nodes[1].config.modelTask.outputSchema.properties)
console.log('PASS live OpenAI: browser → typed filter → human review; valid bindings and output schema, no database writes')
