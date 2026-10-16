import { z } from 'zod'
const name = z.string().min(1).max(200)
const column = name.refine(v => !['__proto__', 'constructor', 'prototype'].includes(v), 'Reserved column')
const scalar = z.union([z.string().max(1000), z.number().finite(), z.boolean(), z.null()])
export const expectedOutputSchema = z.object({ format: z.enum(['rows', 'xlsx', 'csv', 'json']), filename: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,80}\.(xlsx|csv|json)$/).nullable() }).strict()
export type ExpectedOutput = z.infer<typeof expectedOutputSchema>
const base = { id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), source: name }
export const planStepSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('read') }).strict(),
  z.object({ ...base, type: z.literal('filter'), column, operator: z.enum(['eq','ne','gt','gte','lt','lte','contains','empty']), value: scalar }).strict(),
  z.object({ ...base, type: z.literal('select'), columns: z.array(column).min(1).max(100) }).strict(),
  z.object({ ...base, type: z.literal('rename'), columns: z.array(z.object({ from: column, to: column }).strict()).min(1).max(100) }).strict(),
  z.object({ ...base, type: z.literal('transform'), column, transform: z.enum(['string','number','uppercase','lowercase','trim']) }).strict(),
  z.object({ ...base, type: z.literal('merge'), other: name }).strict(),
  z.object({ ...base, type: z.literal('join'), other: name, leftKey: column, rightKey: column, mode: z.enum(['inner','left']), prefix: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,19}$/) }).strict(),
  z.object({ ...base, type: z.literal('aggregate'), groupBy: z.array(column).max(20), column: column.nullable(), calculation: z.enum(['count','sum','average','min','max']) }).strict(),
  z.object({ ...base, type: z.literal('duplicates'), keys: z.array(column).min(1).max(20) }).strict(),
  z.object({ ...base, type: z.literal('compare'), other: name, keys: z.array(column).min(1).max(20) }).strict(),
  z.object({ ...base, type: z.literal('export'), filename: expectedOutputSchema.shape.filename.unwrap() }).strict(),
])
export const planSchema = z.object({ version: z.literal(1), steps: z.array(planStepSchema).min(1).max(20) }).strict()
export type ProcessingPlan = z.infer<typeof planSchema>
export const fieldSchema = z.object({ name: column, types: z.array(z.enum(['string','number','boolean','null','object','array'])).min(1), nullCount: z.number().int().nonnegative() }).strict()
export const inputSchemaSchema = z.object({
  version: z.literal(1), datasets: z.array(z.object({
    id: name, input: name, format: z.enum(['xlsx','csv','rows','json','text']), sheet: z.string().max(200).nullable(),
    fields: z.array(fieldSchema).max(100), rowCount: z.number().int().min(0).max(100000),
    samples: z.array(z.record(z.string(), scalar)).max(3), structure: z.string().max(2000).nullable(),
  }).strict()).min(1).max(100), warnings: z.array(z.string().max(500)).max(100),
}).strict()
export type InputSchema = z.infer<typeof inputSchemaSchema>
export const approvedPlanSchema = z.object({ version: z.number().int().positive(), plan: planSchema, fingerprint: z.string().regex(/^[a-f0-9]{64}$/), objective: z.string(), expectedOutput: expectedOutputSchema, bindingHash: z.string(), approvedAt: z.string(), testId: z.string().uuid() }).strict()
export type ApprovedPlan = z.infer<typeof approvedPlanSchema>
export const generationRequestSchema = z.object({ workflowId: z.string().uuid(), nodeId: z.string().uuid(), inputSchema: inputSchemaSchema, consent: z.object({ schema: z.literal(true), samples: z.boolean() }).strict() }).strict()
export const generationResponseSchema = z.object({ status: z.enum(['needs_review','needs_configuration']), reason: z.string().max(2000), plan: planSchema.nullable() }).strict()
export type LogicDraft = { status: 'needs_review'; plan: ProcessingPlan; fingerprint: string; objective: string; expectedOutput: ExpectedOutput; bindingHash: string; version: number; workflowUpdatedAt: string }
export type Inspection = { status: 'ready_to_generate' | 'waiting_for_input' | 'failed'; id?: string; schema?: InputSchema; fingerprint?: string; artifacts?: { name: string; format: string; bytes: number }[]; error?: string; objective?: string; expectedOutput?: ExpectedOutput }
export type LogicTest = { status: 'tested' | 'failed'; testId?: string; error?: string; rows: Record<string, unknown>[]; count: number; files: { id: string; name: string; bytes: number }[] }
export type RuntimeLogicAPI = {
  reveal: (inspectionId: string, fileId: string) => Promise<void>
  inspect: (workflowId: string, nodeId: string) => Promise<Inspection>
  generate: (inspectionId: string, shareSamples: boolean, consent: boolean) => Promise<{ status: 'needs_review' | 'needs_configuration'; reason?: string; draft?: LogicDraft }>
  test: (inspectionId: string, plan: ProcessingPlan) => Promise<LogicTest>
  approve: (inspectionId: string, testId: string) => Promise<ApprovedPlan>
}

export function validatePlan(plan: ProcessingPlan, schema: InputSchema, expected: ExpectedOutput) {
  planSchema.parse(plan)
  if(new Set(schema.datasets.map(d=>d.id)).size!==schema.datasets.length)throw new Error('Duplicate input dataset IDs.')
  const datasets = new Map(schema.datasets.map(d => [d.id, d.fields]))
  const stepIds = new Set<string>()
  for (const step of plan.steps) {
    if (datasets.has(step.id) || stepIds.has(step.id)) throw new Error('Duplicate step ID.')
    stepIds.add(step.id)
    let fields = datasets.get(step.source)
    if (!fields) throw new Error(`Unknown source: ${step.source}`)
    if(fields.some(f=>f.types.includes('object')||f.types.includes('array')))throw new Error('Nested JSON requires configuration as a flat dataset.')
    if(new Set(fields.map(f=>f.name)).size!==fields.length)throw new Error('Duplicate input columns.')
    const requireColumns = (names: string[], from = fields!) => { for (const n of names) if (!from.some(f => f.name === n)) throw new Error(`Unknown input column: ${n}`) }
    const other = 'other' in step ? datasets.get(step.other) : undefined
    if ('other' in step && !other) throw new Error('A real comparison or join dataset is required.')
    if (step.type === 'filter' || step.type === 'transform') requireColumns([step.column])
    if (step.type === 'filter' && ['gt','gte','lt','lte'].includes(step.operator) && fields.find(f => f.name === step.column)!.types.some(t => !['number','null'].includes(t))) throw new Error('Numeric filters require an explicit number transform.')
    if(step.type==='filter'&&['gt','gte','lt','lte'].includes(step.operator)&&typeof step.value!=='number')throw new Error('Numeric filter value must be a number.')
    if (step.type === 'select') { requireColumns(step.columns); fields = step.columns.map(n => fields!.find(f => f.name === n)!) }
    if (step.type === 'rename') { requireColumns(step.columns.map(c => c.from)); fields = fields.map(f => ({ ...f, name: step.columns.find(c => c.from === f.name)?.to ?? f.name })) }
    if (step.type === 'transform') fields = fields.map(f => f.name === step.column ? { ...f, types: [step.transform === 'number' ? 'number' as const : 'string' as const, ...(f.types.includes('null') ? ['null' as const] : [])] } : f)
    if (step.type === 'merge') {
      if (JSON.stringify(fields.map(f => [f.name, [...f.types].sort()]).sort()) !== JSON.stringify(other!.map(f => [f.name, [...f.types].sort()]).sort())) throw new Error('Merge requires matching schemas; rename/select/transform columns first.')
    }
    if (step.type === 'join') { requireColumns([step.leftKey]); requireColumns([step.rightKey], other); fields = [...fields, ...other!.map(f => ({ ...f, name: step.prefix + f.name, types: step.mode === 'left' ? [...new Set([...f.types, 'null' as const])] : f.types }))] }
    if (step.type === 'duplicates' || step.type === 'compare') { requireColumns(step.keys); if (step.type === 'compare') requireColumns(step.keys, other) }
    if (step.type === 'aggregate') {
      requireColumns(step.groupBy)
      if (step.calculation !== 'count') { if (!step.column) throw new Error('Aggregate requires a column.'); requireColumns([step.column]); if (fields.find(f => f.name === step.column)!.types.some(t => !['number','null'].includes(t))) throw new Error('Aggregate requires numeric data; transform first.') }
      fields = [...step.groupBy.map(n => fields!.find(f => f.name === n)!), { name: 'result', types: ['number','null'], nullCount: 0 }]
    }
    if(fields.length>100)throw new Error('Resource limit: at most 100 output columns.')
    if (new Set(fields.map(f => f.name)).size !== fields.length) throw new Error('Duplicate output columns.')
    if (step.type === 'export' && (step !== plan.steps.at(-1) || expected.format === 'rows' || step.filename !== expected.filename || !step.filename.endsWith('.' + expected.format))) throw new Error('Export must be last and match the saved expected output.')
    datasets.set(step.id, fields)
  }
  if (expected.format !== 'rows' && plan.steps.at(-1)?.type !== 'export') throw new Error('Expected a report export.')
  return datasets
}
export function fingerprintShape(schema: InputSchema) {
  return schema.datasets.map(d=>({id:d.id,input:d.input,format:d.format,sheet:d.sheet,structure:d.format==='text'?null:d.structure,fields:d.fields.map(f=>({name:f.name,types:[...f.types].sort()})).sort((a,b)=>a.name.localeCompare(b.name))}))
}
export function bindingShape(inputs: Record<string, unknown>) { return Object.fromEntries(Object.entries(inputs).sort(([a],[b])=>a.localeCompare(b))) }
