import { graphSchema, validateProcessing, captureSchema } from '../../contracts/dataProcessing.js'
import { z } from 'zod'

const name = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/)
const primitive = z.enum(['string', 'number', 'boolean'])
const field = z.object({
  name, type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'file']),
  description: z.string().min(1).max(1000), required: z.boolean(),
  itemType: z.enum(['string', 'number', 'boolean', 'object']).nullable(),
  fields: z.array(z.object({ name, type: primitive, description: z.string().min(1).max(500), required: z.boolean() }).strict()).max(30),
}).strict()
export const nodeContractSchema = z.object({
  inputs: z.array(field.extend({ sourceStepId: z.string().min(1).nullable(), sourceOutput: name.nullable() }).strict()).max(20),
  outputs: z.array(field).max(20),
  validationCriteria: z.array(z.string().min(1).max(1000)).max(20),
  requiresHumanReview: z.boolean(),
}).strict()
export type NodeContract = z.infer<typeof nodeContractSchema>

export function validateContract(contract: NodeContract) {
  for (const fields of [contract.inputs, contract.outputs]) {
    if (new Set(fields.map(field => field.name)).size !== fields.length) throw new Error('Duplicate contract field name.')
    for (const field of fields) {
      if ((field.type === 'array') !== (field.itemType !== null)) throw new Error('Array item type is required only for arrays.')
      const structured = field.type === 'object' || field.type === 'array' && field.itemType === 'object'
      if (structured !== (field.fields.length > 0)) throw new Error('Object fields must describe their structure.')
      if (new Set(field.fields.map(item => item.name)).size !== field.fields.length) throw new Error('Duplicate object field name.')
    }
  }
  for (const input of contract.inputs) {
    if ((input.sourceStepId === null) !== (input.sourceOutput === null)) throw new Error('Input source requires both step and output.')
  }
}

// Used when assembling a future model call: description remains the instruction,
// while schemas/bindings describe the data it receives and must return.
export function buildNodeModelTask(description: string, contract: NodeContract) {
  validateContract(contract)
  const shape = (field: NodeContract['outputs'][number]): Record<string, unknown> => {
    if (field.type === 'file') return { type: 'string', description: `${field.description} (artifact ID; file contents are supplied separately)` }
    const object = { type: 'object', properties: Object.fromEntries(field.fields.map(item => [item.name, { type: item.required ? item.type : [item.type, 'null'], description: item.description }])), required: field.fields.map(item => item.name), additionalProperties: false }
    if (field.type === 'object') return object
    if (field.type === 'array') return { type: 'array', items: field.itemType === 'object' ? object : { type: field.itemType } }
    return { type: field.type }
  }
  return {
    instructions: description,
    inputs: contract.inputs,
    inputPreparation: contract.inputs.map(input => ({ name: input.name, sourceStepId: input.sourceStepId, sourceOutput: input.sourceOutput, mode: input.type === 'file' ? 'parse_artifact_contents' : 'value' })),
    outputSchema: { type: 'object', properties: Object.fromEntries(contract.outputs.map(field => {
      const schema = shape(field)
      return [field.name, { ...(field.required ? schema : { anyOf: [schema, { type: 'null' }] }), description: field.description }]
    })), required: contract.outputs.map(field => field.name), additionalProperties: false },
    validationCriteria: contract.validationCriteria,
    requiresHumanReview: contract.requiresHumanReview,
  }
}

export function nodeExecutor(stepType: unknown) {
  return stepType === 'data_processing' ? 'local' : stepType === 'integration' ? 'integration' : stepType === 'logic' ? 'ai' : stepType === 'review' ? 'human' : stepType === 'browser' ? 'recording' : stepType === 'application' ? 'application' : 'manual'
}

export function configureNodeContracts<T extends { id: string; config: Record<string, any> }>(nodes: T[], edges: { sourceNodeId: string; targetNodeId: string }[]): T[] {
  const graph = graphSchema.parse({ nodes, edges })
  for (const node of nodes.filter(n => n.config.stepType === 'data_processing')) {
    const errors = validateProcessing(graph, node.id, node.config.status !== 'ready')
    if (errors.length) throw new Error(errors.join(' '))
  }
  for (const node of nodes) if (node.config.stepType === 'browser' && node.config.outputCapture) captureSchema.parse(node.config.outputCapture)
  const contracts = new Map<string, NodeContract>()
  for (const node of nodes) {
    if (node.config.contract && node.config.stepType !== 'data_processing') {
      const contract = nodeContractSchema.parse(node.config.contract)
      validateContract(contract)
      contracts.set(node.id, contract)
    }
    if (['logic', 'review'].includes(node.config.stepType)) {
      const contract = contracts.get(node.id)
      if (!contract?.inputs.length || !contract.outputs.length || !contract.validationCriteria.length) throw new Error('Logic/review nodes need inputs, outputs and validation criteria.')
      if (node.config.stepType === 'logic' && !contract.inputs.some(input => input.required && input.sourceStepId !== null)) throw new Error('AI data processing requires data from a previous node.')
      if (node.config.stepType === 'review' && !contract.requiresHumanReview) throw new Error('A review node requires human approval.')
    }
  }
  const upstream = (from: string, target: string) => {
    const pending = [from], visited = new Set<string>()
    while (pending.length) {
      const id = pending.pop()!
      if (visited.has(id)) continue
      visited.add(id)
      for (const edge of edges.filter(edge => edge.sourceNodeId === id)) {
        if (edge.targetNodeId === target) return true
        pending.push(edge.targetNodeId)
      }
    }
    return false
  }
  return nodes.map(node => {
    const contract = contracts.get(node.id)
    if (!contract) return { ...node, config: { ...node.config, executor: nodeExecutor(node.config.stepType), modelTask: null } }
    for (const input of contract.inputs) {
      if (input.sourceStepId === null) continue
      const output = contracts.get(input.sourceStepId)?.outputs.find(output => output.name === input.sourceOutput)
      if (!output || input.sourceStepId === node.id || !upstream(input.sourceStepId, node.id) || upstream(node.id, input.sourceStepId)) throw new Error('Input source must be an upstream output without a cycle.')
      if (output.type !== input.type || output.itemType !== input.itemType || input.required && !output.required || input.fields.some(field => !output.fields.some(other => other.name === field.name && other.type === field.type && (!field.required || other.required)))) throw new Error('Input source has an incompatible type.')
    }
    return { ...node, config: { ...node.config, executor: nodeExecutor(node.config.stepType), contract, modelTask: node.config.stepType === 'logic' ? buildNodeModelTask(String(node.config.description ?? ''), contract) : null } }
  })
}
