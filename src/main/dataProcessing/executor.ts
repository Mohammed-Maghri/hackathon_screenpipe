import ExcelJS from 'exceljs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { mkdir, readFile, writeFile, realpath, stat } from 'node:fs/promises'
import { join, extname, basename, dirname, relative, isAbsolute } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { operations, rowsSchema, valueSchema, validateProcessing, isUpstream, type DataFile, type DataGraph, type DataValue, type Operation, type ProcessingConfig, type ProcessingResult, type Row } from '../../shared/dataProcessing'

const MAX_BYTES = 25 * 1024 * 1024
// Paths never cross the renderer boundary. Only verified downloads or generated files enter this store.
export class LocalArtifacts {
  private files = new Map<string, { file: DataFile; path: string; root: string; digest: string }>()
  constructor(readonly directory: string) {}
  async register(path: string, root: string, name = basename(path)): Promise<DataFile> {
    const canonical = await realpath(path), base = await realpath(root), rel = relative(base, canonical)
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('File is outside its trusted directory.')
    const info = await stat(canonical), format = extname(name).slice(1).toLowerCase()
    if (!['xlsx', 'csv', 'json', 'txt'].includes(format)) throw new Error(`Unsupported format: ${name}. Use XLSX, CSV, JSON or TXT.`)
    if (!info.isFile() || info.size > MAX_BYTES) throw new Error('Expected a file smaller than 25 MB.')
    const file: DataFile = { id: randomUUID(), name, format: format as DataFile['format'], bytes: info.size }
    this.files.set(file.id, { file, path: canonical, root: base, digest: createHash('sha256').update(await readFile(canonical)).digest('hex') })
    return file
  }
  async resolve(file: DataFile): Promise<string> {
    const saved = this.files.get(file.id)
    if (!saved || JSON.stringify(saved.file) !== JSON.stringify(file)) throw new Error(`Unknown or changed file reference: ${file.name}`)
    try {
      const path = await realpath(saved.path), rel = relative(saved.root, path), info = await stat(path)
      if (rel.startsWith('..') || isAbsolute(rel) || !info.isFile() || info.size !== file.bytes || info.size > MAX_BYTES) throw new Error('File changed')
      if (createHash('sha256').update(await readFile(path)).digest('hex') !== saved.digest) throw new Error('File contents changed')
      return path
    } catch { throw new Error(`Missing or changed file: ${file.name}. Run the download node again.`) }
  }
  async getPath(id: string) { const entry = this.files.get(id); if (!entry) throw new Error('Unknown artifact'); return this.resolve(entry.file) }
  snapshot() { return [...this.files.entries()] }
  restore(entries: ReturnType<LocalArtifacts['snapshot']>) { this.files = new Map(entries) }
}
function checkedColumns(rows: Row[], columns: string[]) {
  for (const row of rows) for (const column of columns) if (!Object.hasOwn(row, column)) throw new Error(`Missing column: ${column}`)
}
function identity(row: Row, keys: string[]) { return JSON.stringify(keys.map(k => row[k])) }
function predicate(row: Row, rule: { column: string; operator: string; value?: unknown }): boolean {
  const value = row[rule.column], expected = rule.value
  switch (rule.operator) {
    case 'eq': return value === expected
    case 'ne': return value !== expected
    case 'empty': return value === null || value === ''
    case 'contains': return typeof value === 'string' && typeof expected === 'string' && value.includes(expected)
    default:
      if (typeof value !== 'number' || typeof expected !== 'number') throw new Error(`Numeric comparison requires numbers in ${rule.column}.`)
      return rule.operator === 'gt' ? value > expected : rule.operator === 'gte' ? value >= expected : rule.operator === 'lt' ? value < expected : value <= expected
  }
}
export function normalizeCell(value: ExcelJS.CellValue): Row[string] {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== 'object') return value
  // Never evaluate formulas or follow hyperlinks. Cached formula results are data only.
  if ('formula' in value || 'sharedFormula' in value) {
    if (value.result === undefined) throw new Error('A formula has no cached result. Recalculate and save the workbook first.')
    return normalizeCell(value.result)
  }
  if ('richText' in value) return value.richText.map(v => v.text).join('')
  if ('text' in value) return value.text
  throw new Error('Spreadsheet contains an invalid cell or formula error.')
}
export async function readDataFile(file: DataFile, artifacts: LocalArtifacts, sheetName?: string): Promise<Row[]> {
  if (!['xlsx','csv'].includes(file.format)) throw new Error('This operation requires CSV or XLSX files.')
  const path = await artifacts.resolve(file)
  try {
    let matrix: Row[string][][]
    if (file.format === 'csv') {
      matrix = parse(await readFile(path, 'utf8'), { bom: true, skip_empty_lines: true, max_record_size: 1024 * 1024 }) as string[][]
    } else {
      const book = new ExcelJS.Workbook()
      await book.xlsx.readFile(path)
      const sheet = sheetName ? book.getWorksheet(sheetName) : book.worksheets[0]
      if (!sheet) throw new Error('Requested worksheet does not exist.')
      if (sheet.rowCount > 100001 || sheet.columnCount > 500) throw new Error('Spreadsheet exceeds 100,000 rows or 500 columns.')
      matrix = []
      sheet.eachRow({ includeEmpty: false }, row => { matrix.push(Array.from({ length: sheet.columnCount }, (_, i) => normalizeCell(row.getCell(i + 1).value))) })
    }
    if (!matrix.length) return []
    const headers = matrix[0].map(v => String(v ?? '').trim())
    if (headers.some(h => !h || ['__proto__', 'constructor', 'prototype'].includes(h)) || new Set(headers).size !== headers.length) throw new Error('Headers must be nonempty, unique column names.')
    if (headers.length > 500) throw new Error('Too many columns.')
    return rowsSchema.parse(matrix.slice(1).map(values => {
      if (values.length > headers.length) throw new Error('Row has more values than headers.')
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? null]))
    }))
  } catch (error) { throw new Error(`Cannot read ${file.name}: ${error instanceof Error ? error.message : 'invalid spreadsheet'}`) }
}
function rowsOutput(rows: Row[]): Record<string, DataValue> { return { rows: { type: 'rows', value: rows }, count: { type: 'number', value: rows.length } } }
// Registry implementations are trusted TypeScript functions; no eval or model-authored code.
export const handlers: Record<keyof typeof operations, (inputs: Record<string, DataValue>, config: ProcessingConfig, artifacts: LocalArtifacts) => Promise<Record<string, DataValue>>> = {
  async read_files(inputs, config, artifacts) {
    if (inputs.files.type !== 'files' || !inputs.files.value.length) throw new Error('No downloaded files. Run the browser node first.')
    let rows: Row[] = []
    for (const file of inputs.files.value) { rows = rows.concat(await readDataFile(file, artifacts, config.rules.sheet as string | undefined)); if (rows.length > 100000) throw new Error('Combined dataset exceeds 100,000 rows.') }
    return rowsOutput(rows)
  },
  async merge_files(inputs, config, artifacts) { return handlers.read_files(inputs, config, artifacts) },
  async filter_rows(inputs, config) {
    const rows = getRows(inputs), rules = operations.filter_rows.rules.parse(config.rules)
    checkedColumns(rows, rules.predicates.map(p => p.column))
    return rowsOutput(rows.filter(row => rules.mode === 'all' ? rules.predicates.every(p => predicate(row, p)) : rules.predicates.some(p => predicate(row, p))))
  },
  async map_columns(inputs, config) {
    const rows = getRows(inputs), rules = operations.map_columns.rules.parse(config.rules)
    checkedColumns(rows, rules.columns.map(c => c.source))
    return rowsOutput(rows.map(row => Object.fromEntries(rules.columns.map(c => {
      const value = row[c.source]
      if (c.transform === 'identity' || value === null) return [c.target, value]
      if (c.transform === 'number') { const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN; if (!Number.isFinite(n)) throw new Error(`Invalid number in ${c.source}`); return [c.target, n] }
      const text = String(value)
      return [c.target, c.transform === 'uppercase' ? text.toUpperCase() : c.transform === 'lowercase' ? text.toLowerCase() : c.transform === 'trim' ? text.trim() : text]
    }))))
  },
  async compare_datasets(inputs, config) {
    const rows = getRows(inputs), comparison = getRows(inputs, 'comparison'), { keys } = operations.compare_datasets.rules.parse(config.rules)
    checkedColumns(rows, keys); checkedColumns(comparison, keys)
    const right = new Set(comparison.map(row => identity(row, keys)))
    return rowsOutput(rows.filter(row => !right.has(identity(row, keys))))
  },
  async find_duplicates(inputs, config) {
    const rows = getRows(inputs), { keys } = operations.find_duplicates.rules.parse(config.rules), seen = new Set<string>()
    checkedColumns(rows, keys)
    return rowsOutput(rows.filter(row => { const key = identity(row, keys); if (seen.has(key)) return true; seen.add(key); return false }))
  },
  async detect_missing(inputs, config) {
    const rows = getRows(inputs), { key, expectedIds } = operations.detect_missing.rules.parse(config.rules)
    checkedColumns(rows, [key])
    const expected = inputs.comparison ? getRows(inputs, 'comparison') : expectedIds?.map(id => ({ [key]: id }))
    if (!expected) throw new Error('Explicit expected IDs or comparison rows are required.')
    checkedColumns(expected, [key])
    const actual = new Set(rows.map(row => identity(row, [key]))), emitted = new Set<string>()
    return rowsOutput(expected.filter(row => { const id = identity(row, [key]); if (actual.has(id) || emitted.has(id)) return false; emitted.add(id); return true }))
  },
  async aggregate(inputs, config) {
    const rows = getRows(inputs), rules = operations.aggregate.rules.parse(config.rules)
    checkedColumns(rows, [...rules.groupBy, ...(rules.column ? [rules.column] : [])])
    const groups = new Map<string, Row[]>()
    if (!rules.groupBy.length) groups.set('[]', [])
    for (const row of rows) { const key = identity(row, rules.groupBy); const group = groups.get(key) ?? []; group.push(row); groups.set(key, group) }
    return rowsOutput([...groups.values()].map(group => {
      const values = rules.calculation === 'count' ? [] : group.map(row => { const value = row[rules.column!]; if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Expected numeric values in ${rules.column}. Transform CSV columns to numbers first.`); return value })
      const total = values.reduce((a, b) => a + b, 0)
      const result = rules.calculation === 'count' ? group.length : rules.calculation === 'sum' ? total : !values.length ? null : rules.calculation === 'average' ? total / values.length : rules.calculation === 'min' ? Math.min(...values) : Math.max(...values)
      return { ...Object.fromEntries(rules.groupBy.map(k => [k, group[0]?.[k] ?? null])), result }
    }))
  },
  async conditional(inputs, config) {
    const rows = getRows(inputs), rules = operations.conditional.rules.parse(config.rules)
    checkedColumns(rows, [rules.predicate.column])
    const matched = rows.length > 0 && (rules.mode === 'all' ? rows.every(r => predicate(r, rules.predicate)) : rows.some(r => predicate(r, rules.predicate)))
    return { ...rowsOutput(matched ? rows : []), matched: { type: 'boolean', value: matched } }
  },
  async generate_report(inputs, config, artifacts) {
    const rows = getRows(inputs), rules = operations.generate_report.rules.parse(config.rules)
    if (!config.output) throw new Error('Output filename is required.')
    if (rules.columns) checkedColumns(rows, rules.columns)
    const columns = rules.columns ?? [...new Set(rows.flatMap(row => Object.keys(row)))]
    if (!columns.length && !config.output.filename.endsWith('.json')) throw new Error('Empty datasets require explicit output columns.')
    const directory = join(artifacts.directory, randomUUID())
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const path = join(directory, config.output.filename)
    const jsonRows = extname(path) === '.json' ? rows.map(row => Object.fromEntries(columns.map(column => [column, row[column]]))) : []
    if (extname(path) === '.json') {
      const serialized = JSON.stringify(jsonRows, null, 2) + '\n'
      if (Buffer.byteLength(serialized) > MAX_BYTES) throw new Error('Resource limit: JSON output exceeds 25 MB.')
      await writeFile(path, serialized, { mode: 0o600 })
    } else if (extname(path) === '.csv') {
      await writeFile(path, stringify(rows, { header: true, columns, escape_formulas: true }), { mode: 0o600 })
    } else {
      const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('Report')
      sheet.columns = columns.map(key => ({ header: key, key, width: 22 }))
      sheet.addRows(rows)
      sheet.getRow(1).font = { bold: true }
      await book.xlsx.writeFile(path)
    }
    const file = await artifacts.register(path, dirname(path))
    // Read back the actual artifact before reporting verified success.
    const written = file.format === 'json' ? rowsSchema.parse(JSON.parse(await readFile(await artifacts.resolve(file), 'utf8'))) : await readDataFile(file, artifacts)
    if (file.format === 'json' && JSON.stringify(written) !== JSON.stringify(jsonRows)) throw new Error('Generated JSON content verification failed.')
    if (written.length !== rows.length) throw new Error('Generated report verification failed.')
    return { files: { type: 'files', value: [file] }, count: { type: 'number', value: rows.length } }
  },
}
function getRows(inputs: Record<string, DataValue>, name = 'rows'): Row[] { const input = inputs[name]; if (input?.type !== 'rows') throw new Error(`Expected rows input: ${name}`); return input.value }
export class DataProcessingExecutor {
  readonly outputs = new Map<string, Record<string, DataValue>>()
  constructor(readonly artifacts: LocalArtifacts) {}
  async execute(graph: DataGraph, nodeId: string): Promise<ProcessingResult> {
    for (const node of graph.nodes) if (node.id === nodeId || isUpstream(graph, nodeId, node.id)) this.outputs.delete(node.id)
    try {
      const errors = validateProcessing(graph, nodeId)
      if (errors.length) throw new Error(errors.join('\n'))
      const config = graph.nodes.find(n => n.id === nodeId)!.config.dataProcessing!
      const op: Operation = operations[config.operation], inputs: Record<string, DataValue> = {}
      for (const port of op.inputs) {
        const ref = config.inputs[port.name]
        if (!ref && port.optional) continue
        const output = ref && this.outputs.get(ref.nodeId)?.[ref.output]
        if (!output) throw new Error(`Input ${port.name} is unavailable. Run its upstream node first.`)
        const parsed = valueSchema.parse(output)
        if (parsed.type !== port.type) throw new Error(`Input ${port.name} has an incompatible runtime type.`)
        inputs[port.name] = parsed
      }
      const outputs = await handlers[config.operation](inputs, { ...config, rules: op.rules.parse(config.rules) as Record<string, unknown> }, this.artifacts)
      if (Object.keys(outputs).length !== op.outputs.length) throw new Error('Unexpected operation output.')
      for (const port of op.outputs) { const parsed = valueSchema.parse(outputs[port.name]); if (parsed.type !== port.type) throw new Error(`Invalid generated output: ${port.name}`); outputs[port.name] = parsed }
      this.outputs.set(nodeId, outputs)
      return { nodeId, status: 'VERIFIED', outputs }
    } catch (error) { return { nodeId, status: 'FAILED', outputs: {}, error: error instanceof Error ? error.message : 'Processing failed.' } }
  }
}
