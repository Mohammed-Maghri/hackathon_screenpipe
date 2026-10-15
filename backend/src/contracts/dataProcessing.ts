import { approvedPlanSchema, expectedOutputSchema } from './processingPlan.js'
import { z } from 'zod'

export const scalarSchema = z.union([z.string().max(100000), z.number().finite(), z.boolean(), z.null()])
export const rowsSchema = z.array(z.record(z.string(), scalarSchema)).max(100000)
export type Row = z.infer<typeof rowsSchema>[number]
export const fileSchema = z.object({ id: z.string().uuid(), name: z.string(), format: z.enum(['xlsx', 'csv', 'json', 'txt']), bytes: z.number().nonnegative() }).strict()
export type DataFile = z.infer<typeof fileSchema>
export const captureSchema = z.object({ textSelector: z.string().max(500).optional(), tableSelector: z.string().max(500).optional(), jsonSelector: z.string().max(500).optional() }).strict()
export const valueSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('files'), value: z.array(fileSchema).max(100) }).strict(),
  z.object({ type: z.literal('rows'), value: rowsSchema }).strict(),
  z.object({ type: z.literal('text'), value: z.string().max(1000000) }).strict(),
  z.object({ type: z.literal('json'), value: z.json() }).strict(),
  z.object({ type: z.literal('number'), value: z.number().finite() }).strict(),
  z.object({ type: z.literal('boolean'), value: z.boolean() }).strict(),
])
export type DataValue = z.infer<typeof valueSchema>
export type DataType = DataValue['type']
export const referenceSchema = z.object({ nodeId: z.string().min(1), output: z.string().min(1), type: z.enum(['files', 'rows', 'number', 'boolean', 'text', 'json']) }).strict()
const column = z.string().trim().min(1).max(200).refine(s => !['__proto__', 'constructor', 'prototype'].includes(s), 'Reserved column name')
const keyRules = z.object({ keys: z.array(column).min(1).max(20) }).strict()
const predicate = z.object({ column, operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'empty']), value: scalarSchema.optional() }).strict().refine(p => p.operator === 'empty' || p.value !== undefined, 'Comparison value is required')
export type Port = { name: string; type: DataType; optional?: boolean }
export type Operation = { label: string; inputs: Port[]; outputs: Port[]; rules: z.ZodType; defaults: Record<string, unknown> }
const rows: Port = { name: 'rows', type: 'rows' }
const count: Port = { name: 'count', type: 'number' }
export const operations = {
  read_files: { label: 'Read Excel / CSV', inputs: [{ name: 'files', type: 'files' }], outputs: [rows, count], rules: z.object({ sheet: z.string().optional() }).strict(), defaults: {} },
  merge_files: { label: 'Merge files', inputs: [{ name: 'files', type: 'files' }], outputs: [rows, count], rules: z.object({ sheet: z.string().optional() }).strict(), defaults: {} },
  filter_rows: { label: 'Filter rows', inputs: [rows], outputs: [rows, count], rules: z.object({ predicates: z.array(predicate).min(1), mode: z.enum(['all', 'any']) }).strict(), defaults: { predicates: [{ column: 'status', operator: 'eq', value: 'failed' }], mode: 'all' } },
  map_columns: { label: 'Transform columns', inputs: [rows], outputs: [rows, count], rules: z.object({ columns: z.array(z.object({ source: column, target: column, transform: z.enum(['identity', 'string', 'number', 'uppercase', 'lowercase', 'trim']) }).strict()).min(1) }).strict().refine(r => new Set(r.columns.map(c => c.target)).size === r.columns.length, 'Duplicate target columns'), defaults: { columns: [{ source: 'id', target: 'id', transform: 'string' }] } },
  compare_datasets: { label: 'Compare datasets', inputs: [rows, { name: 'comparison', type: 'rows' }], outputs: [rows, count], rules: keyRules, defaults: { keys: ['id'] } },
  find_duplicates: { label: 'Find duplicates', inputs: [rows], outputs: [rows, count], rules: keyRules, defaults: { keys: ['id'] } },
  detect_missing: { label: 'Detect missing records', inputs: [rows, { name: 'comparison', type: 'rows', optional: true }], outputs: [rows, count], rules: z.object({ key: column, expectedIds: z.array(z.union([z.string(), z.number().finite()])).optional() }).strict(), defaults: { key: 'id' } },
  aggregate: { label: 'Aggregate totals', inputs: [rows], outputs: [rows, count], rules: z.object({ groupBy: z.array(column), column: column.optional(), calculation: z.enum(['count', 'sum', 'average', 'min', 'max']) }).strict().refine(r => r.calculation === 'count' || !!r.column, 'A numeric column is required').refine(r => !r.groupBy.includes('result') && new Set(r.groupBy).size === r.groupBy.length, 'Group columns must be unique and cannot use the result output name'), defaults: { groupBy: [], calculation: 'count' } },
  generate_report: { label: 'Generate Excel / CSV / JSON', inputs: [rows], outputs: [{ name: 'files', type: 'files' }, count], rules: z.object({ columns: z.array(column).min(1).optional() }).strict().refine(r => !r.columns || new Set(r.columns).size === r.columns.length, 'Output columns must be unique'), defaults: {} },
  conditional: { label: 'Conditional logic', inputs: [rows], outputs: [rows, count, { name: 'matched', type: 'boolean' }], rules: z.object({ predicate, mode: z.enum(['all', 'any']) }).strict(), defaults: { predicate: { column: 'status', operator: 'eq', value: 'failed' }, mode: 'any' } },
} satisfies Record<string, Operation>
export type OperationName = keyof typeof operations
export const processingSchema = z.object({
  mode: z.enum(['manual', 'generated']).optional(), inferOutput: z.boolean().optional(), expectedOutput: expectedOutputSchema.optional(), approvedPlan: approvedPlanSchema.optional(),
  version: z.literal(1), operation: z.enum(Object.keys(operations) as [OperationName, ...OperationName[]]),
  inputs: z.record(z.string(), referenceSchema), rules: z.record(z.string(), z.unknown()),
  output: z.object({ filename: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,100}\.(xlsx|csv|json)$/).refine(s => !s.includes('..'), 'Invalid filename') }).strict().optional(),
}).strict()
export type ProcessingConfig = z.infer<typeof processingSchema>
export type DataNode = { id: string; config: { stepType?: string; dataProcessing?: ProcessingConfig; status?: string } }
export type DataGraph = { nodes: DataNode[]; edges: { sourceNodeId: string; targetNodeId: string }[] }
export const graphSchema = z.object({ nodes: z.array(z.object({ id: z.string().min(1), config: z.object({ stepType: z.string().optional(), dataProcessing: processingSchema.optional(), status: z.string().optional() }) })).max(500), edges: z.array(z.object({ sourceNodeId: z.string(), targetNodeId: z.string() })).max(2000) })
export function defaultProcessing(operation: OperationName = 'read_files'): ProcessingConfig {
  return { version: 1, operation, inputs: {}, rules: structuredClone(operations[operation].defaults), ...(operation === 'generate_report' ? { output: { filename: 'consolidated_report.xlsx' } } : {}) }
}
export function outputPorts(node: DataNode): Port[] {
  if (node.config.stepType === 'browser') return [{ name: 'files', type: 'files' }, { name: 'text', type: 'text' }, { name: 'table', type: 'rows' }, { name: 'json', type: 'json' }, { name: 'metadata', type: 'json' }]
  if (node.config.dataProcessing?.mode === 'generated') return [{ name: 'rows', type: 'rows' }, { name: 'count', type: 'number' }, ...(node.config.dataProcessing.expectedOutput?.format !== 'rows' ? [{ name: 'files', type: 'files' as const }] : [])]
  if (node.config.stepType === 'data_processing' && node.config.dataProcessing) return operations[node.config.dataProcessing.operation]?.outputs ?? []
  return []
}
export function isUpstream(graph: DataGraph, source: string, target: string): boolean {
  const queue = [source], seen = new Set<string>()
  while (queue.length) { const id = queue.pop()!; if (seen.has(id)) continue; seen.add(id); for (const edge of graph.edges.filter(e => e.sourceNodeId === id)) { if (edge.targetNodeId === target) return true; queue.push(edge.targetNodeId) } }
  return false
}
export function validateProcessing(graph: DataGraph, nodeId: string, draft = false): string[] {
  const errors: string[] = []
  const node = graph.nodes.find(n => n.id === nodeId)
  const parsed = processingSchema.safeParse(node?.config.dataProcessing)
  if (!parsed.success) return parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
  const config = parsed.data
  const op: Operation = config.mode === 'generated' ? { label: 'Generated plan', inputs: Object.entries(config.inputs).map(([name, ref]) => ({ name, type: ref.type })), outputs: [], rules: z.record(z.string(), z.unknown()), defaults: {} } : operations[config.operation]
  if (config.mode === 'generated' && !Object.keys(config.inputs).length && !draft) errors.push('Map at least one verified upstream output.')
  const rules = op.rules.safeParse(config.rules)
  if (!rules.success && !draft) errors.push(...rules.error.issues.map(i => `Rules ${i.path.join('.')}: ${i.message}`))
  if (config.mode !== 'generated' && !draft && config.operation === 'generate_report' && !config.output) errors.push('Choose an output filename (.xlsx, .csv or .json).')
  if (config.mode !== 'generated' && !draft && config.operation === 'detect_missing' && !config.inputs.comparison && !Array.isArray(config.rules.expectedIds)) errors.push('Missing detection requires a comparison dataset or explicit expectedIds.')
  if (config.mode !== 'generated' && !draft && config.operation === 'detect_missing' && config.inputs.comparison && Array.isArray(config.rules.expectedIds)) errors.push('Choose either comparison rows or expectedIds, not both.')
  for (const name of Object.keys(config.inputs)) if (!op.inputs.some(p => p.name === name)) errors.push(`Unknown input: ${name}`)
  for (const port of op.inputs) {
    const ref = config.inputs[port.name]
    if (!ref) { if (!port.optional && !draft) errors.push(`Map input: ${port.name} (${port.type}).`); continue }
    const source = graph.nodes.find(n => n.id === ref.nodeId)
    const output = source && outputPorts(source).find(p => p.name === ref.output)
    if (!source || source.id === nodeId || !isUpstream(graph, source.id, nodeId) || isUpstream(graph, nodeId, source.id)) errors.push(`${port.name}: source must be an existing upstream node without a cycle.`)
    if (!output || output.type !== port.type || ref.type !== port.type) errors.push(`${port.name}: incompatible output type.`)
  }
  return errors
}
export type ProcessingResult = { nodeId: string; status: 'VERIFIED' | 'FAILED' | 'SKIPPED'; outputs: Record<string, DataValue>; error?: string }
export type ProcessingEvent = { workflowId: string; nodeId: string; status: 'RUNNING' | ProcessingResult['status']; error?: string }
export type ProcessingRequest = { workflowId: string; graph: DataGraph; nodeId?: string }
export type ProcessingAPI = { onStatus: (listener: (event: ProcessingEvent) => void) => () => void; run: (request: ProcessingRequest) => Promise<ProcessingResult[]>; reveal: (workflowId: string, fileId: string) => Promise<void> }
