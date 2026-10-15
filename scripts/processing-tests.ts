import { createWorkflowSchema } from '../backend/src/modules/workflows/workflow.schemas'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, unlink, mkdir, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { DataProcessingExecutor, LocalArtifacts, readDataFile } from '../src/main/dataProcessing/executor'
import { defaultProcessing, graphSchema, operations, validateProcessing, type DataGraph, type OperationName, type ProcessingConfig, type DataValue } from '../src/shared/dataProcessing'
import { configureNodeContracts } from '../backend/src/modules/workflows/node-contract'

const root = await mkdtemp(join(tmpdir(), 'ghost-data-tests-'))
const artifacts = new LocalArtifacts(join(root, 'generated'))
const executor = new DataProcessingExecutor(artifacts)
const browser = { id: 'download', config: { stepType: 'browser' } }
function node(id: string, operation: OperationName, inputs: ProcessingConfig['inputs'], rules = defaultProcessing(operation).rules) { return { id, config: { stepType: 'data_processing', dataProcessing: { ...defaultProcessing(operation), inputs, rules } } } }
const reference = (nodeId: string, output: string, type: DataValue['type']) => ({ nodeId, output, type })
const graph: DataGraph = { nodes: [browser, node('merge', 'merge_files', { files: reference('download', 'files', 'files') }), node('failed', 'filter_rows', { rows: reference('merge', 'rows', 'rows') }), node('report', 'generate_report', { rows: reference('failed', 'rows', 'rows') })], edges: [['download', 'merge'], ['merge', 'failed'], ['failed', 'report']].map(([sourceNodeId, targetNodeId]) => ({ sourceNodeId, targetNodeId })) }
const files = []
for (let i = 0; i < 2; i++) {
  const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('Transactions')
  sheet.addRow(['id', 'status', 'amount'])
  sheet.addRow([`ok-${i}`, 'completed', 100 + i])
  sheet.addRow([`failed-${i}`, 'failed', 25 + i])
  const path = join(root, `report-${i}.xlsx`)
  await book.xlsx.writeFile(path)
  files.push(await artifacts.register(path, root))
}
executor.outputs.set('download', { files: { type: 'files', value: files } })
for (const id of ['merge', 'failed', 'report']) { const result = await executor.execute(graph, id); assert.equal(result.status, 'VERIFIED', result.error) }
assert.deepEqual(executor.outputs.get('merge')?.count, { type: 'number', value: 4 })
assert.deepEqual(executor.outputs.get('failed')?.count, { type: 'number', value: 2 })
const report = executor.outputs.get('report')!.files
assert.equal(report.type, 'files')
if (report.type !== 'files') throw Error('Expected file')
const output = new ExcelJS.Workbook(); await output.xlsx.readFile(await artifacts.resolve(report.value[0]))
assert.equal(output.worksheets[0].rowCount, 3)
assert.deepEqual(output.worksheets[0].getRow(2).values, [, 'failed-0', 'failed', 25])
assert.deepEqual(output.worksheets[0].getRow(3).values, [, 'failed-1', 'failed', 26])
console.log('PASS Excel read, merge, failed transaction filtering, output propagation, actual generated workbook contents/counts')

async function execute(operation: OperationName, rules: Record<string, unknown>, rows: Record<string, string | number | boolean | null>[], comparison?: typeof rows) {
  const inputs: ProcessingConfig['inputs'] = { rows: reference('merge', 'rows', 'rows') }
  const nodes = [graph.nodes[1]]
  const edges = [{ sourceNodeId: 'merge', targetNodeId: 'op' }]
  executor.outputs.set('merge', { rows: { type: 'rows', value: rows } })
  if (comparison) { nodes.push(node('comparison', 'merge_files', {})); inputs.comparison = reference('comparison', 'rows', 'rows'); executor.outputs.set('comparison', { rows: { type: 'rows', value: comparison } }); edges.push({ sourceNodeId: 'comparison', targetNodeId: 'op' }) }
  nodes.push(node('op', operation, inputs, rules))
  return executor.execute({ nodes, edges }, 'op')
}
const missing = await execute('detect_missing', { key: 'id', expectedIds: ['A', 'B', 'B'] }, [{ id: 'A' }])
assert.deepEqual(missing.outputs.rows, { type: 'rows', value: [{ id: 'B' }] })
assert.equal((await execute('detect_missing', { key: 'id' }, [])).status, 'FAILED')
assert.equal((await execute('detect_missing', { key: 'id' }, [{ id: 'A' }], [{ id: 'B', expected: true }])).status, 'VERIFIED')
assert.deepEqual((await execute('detect_missing', { key: 'id', expectedIds: [] }, [])).outputs.count, { type: 'number', value: 0 })
assert.equal((await execute('filter_rows', { predicates: [], mode: 'all' }, [])).status, 'FAILED')
assert.equal((await execute('filter_rows', operations.filter_rows.defaults, [{ wrong: 'failed' }])).status, 'FAILED')
assert.deepEqual((await execute('filter_rows', operations.filter_rows.defaults, [])).outputs.count, { type: 'number', value: 0 })
assert.deepEqual((await execute('find_duplicates', { keys: ['id'] }, [{ id: 1 }, { id: 1 }, { id: 2 }])).outputs.count, { type: 'number', value: 1 })
assert.deepEqual((await execute('compare_datasets', { keys: ['id'] }, [{ id: 1 }, { id: 2 }], [{ id: 1 }])).outputs.rows, { type: 'rows', value: [{ id: 2 }] })
assert.deepEqual((await execute('map_columns', { columns: [{ source: 'amount', target: 'total', transform: 'number' }] }, [{ amount: '10' }])).outputs.rows, { type: 'rows', value: [{ total: 10 }] })
assert.equal((await execute('map_columns', { columns: [{ source: 'amount', target: 'total', transform: 'number' }] }, [{ amount: 'oops' }])).status, 'FAILED')
assert.deepEqual((await execute('aggregate', { groupBy: ['status'], column: 'amount', calculation: 'sum' }, [{ status: 'failed', amount: 25 }, { status: 'failed', amount: 26 }])).outputs.rows, { type: 'rows', value: [{ status: 'failed', result: 51 }] })
assert.deepEqual((await execute('conditional', operations.conditional.defaults, [{ status: 'completed' }])).outputs.matched, { type: 'boolean', value: false })
assert.equal((await execute('generate_report', { columns: ['id', 'amount'] }, [])).status, 'VERIFIED')
assert.equal((await execute('generate_report', {}, [])).status, 'FAILED')
console.log('PASS every operation, explicit missing expectations, empty data, invalid rules and columns, deterministic conditional logic')

for (const mutate of [
  (g: DataGraph) => { g.nodes[2].config.dataProcessing!.inputs.rows.nodeId = 'unknown' },
  (g: DataGraph) => { g.nodes[2].config.dataProcessing!.inputs.rows.type = 'files' },
  (g: DataGraph) => { g.nodes[2].config.dataProcessing!.inputs.rows.output = 'files' },
  (g: DataGraph) => { g.edges = [] },
  (g: DataGraph) => { g.edges.push({ sourceNodeId: 'failed', targetNodeId: 'merge' }) },
]) { const invalid = structuredClone(graph); mutate(invalid); assert.ok(validateProcessing(invalid, 'failed').length) }
const valid = structuredClone(graph)
assert.deepEqual(validateProcessing(valid, 'failed'), [])
assert.equal(configureNodeContracts(valid.nodes, valid.edges)[1].config.executor, 'local')
assert.doesNotThrow(() => configureNodeContracts([node('draft', 'read_files', {})], []))
assert.throws(() => configureNodeContracts([{ ...node('draft', 'read_files', {}), config: { ...node('draft', 'read_files', {}).config, status: 'ready' } }], []))
assert.throws(() => graphSchema.parse({ ...graph, nodes: [node('bad', 'read_files', { files: '{{nodes.download.outputs.files}}' as never })] }))
executor.outputs.delete('merge'); assert.equal((await executor.execute(graph, 'failed')).status, 'FAILED'); assert.equal(executor.outputs.has('failed'), false)
executor.outputs.set('merge', { rows: { type: 'number', value: 4 } }); assert.equal((await executor.execute(graph, 'failed')).status, 'FAILED')
console.log('PASS typed mapping, existing/upstream/type/cycle checks, draft versus ready validation, missing and invalid runtime outputs, stale output invalidation')

const csv = join(root, 'quoted.csv'); await writeFile(csv, 'id,note\r\n1,"hello, world"\r\n2,"two\nlines"\r\n')
assert.deepEqual(await readDataFile(await artifacts.register(csv, root), artifacts), [{ id: '1', note: 'hello, world' }, { id: '2', note: 'two\nlines' }])
const broken = join(root, 'broken.xlsx'); await writeFile(broken, 'not a workbook')
await assert.rejects(() => artifacts.register(broken, root, 'macro.xlsm'), /Unsupported/)
await assert.rejects(async () => readDataFile(await artifacts.register(broken, root), artifacts), /Cannot read/)
const duplicate = join(root, 'duplicate.csv'); await writeFile(duplicate, 'id,id\n1,2\n')
await assert.rejects(async () => readDataFile(await artifacts.register(duplicate, root), artifacts), /unique/)
await unlink(csv)
await assert.rejects(() => artifacts.resolve(files[0] && { ...files[0], id: crypto.randomUUID() }), /Unknown/)
const disappeared = await artifacts.register(broken, root); await unlink(broken); await assert.rejects(() => artifacts.resolve(disappeared), /Missing/)
const outside = await mkdtemp(join(tmpdir(), 'ghost-outside-')); await writeFile(join(outside, 'outside.csv'), 'id\n1\n'); await mkdir(join(root, 'links')); await symlink(join(outside, 'outside.csv'), join(root, 'links', 'outside.csv'))
await assert.rejects(() => artifacts.register(join(root, 'links', 'outside.csv'), root), /outside/)
console.log('PASS CSV quoting, multiline cells, invalid spreadsheets/formats/headers, missing files, forged refs and symlink escape')

const csvGraph: DataGraph = { nodes: [graph.nodes[1], node('csv-report', 'generate_report', { rows: reference('merge', 'rows', 'rows') })], edges: [{ sourceNodeId: 'merge', targetNodeId: 'csv-report' }] }
csvGraph.nodes[1].config.dataProcessing!.output = { filename: 'safe.csv' }
executor.outputs.set('merge', { rows: { type: 'rows', value: [{ id: '1', note: '=SUM(A1:A2)' }, { id: '2', note: 'hello, world' }] } })
const csvResult = await executor.execute(csvGraph, 'csv-report')
assert.equal(csvResult.status, 'VERIFIED', csvResult.error)
const csvFiles = csvResult.outputs.files
if (csvFiles.type !== 'files') throw Error('Expected CSV output')
assert.deepEqual(await readDataFile(csvFiles.value[0], artifacts), [{ id: '1', note: "'=SUM(A1:A2)" }, { id: '2', note: 'hello, world' }])
const mutablePath = join(root, 'mutable.csv'); await writeFile(mutablePath, 'id\n1\n')
const mutable = await artifacts.register(mutablePath, root); await writeFile(mutablePath, 'id\n2\n')
await assert.rejects(() => artifacts.resolve(mutable), /changed/)
executor.outputs.set('report', { count: { type: 'number', value: 99 } })
executor.outputs.delete('download')
await executor.execute(graph, 'merge')
assert.equal(executor.outputs.has('report'), false)
console.log('PASS CSV report round-trip and formula escaping, same-size file mutation detection, downstream invalidation')

const example = createWorkflowSchema.parse(JSON.parse(await readFile('examples/transaction-processing.workflow.json', 'utf8')))
assert.equal(configureNodeContracts(example.nodes, example.edges).length, 4)
console.log('PASS example workflow uses the existing persisted workflow schema')
