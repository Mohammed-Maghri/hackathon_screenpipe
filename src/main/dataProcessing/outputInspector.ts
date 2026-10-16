import ExcelJS from 'exceljs'
import { parse } from 'csv-parse/sync'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { type DataValue, type Row, rowsSchema } from '../../shared/dataProcessing'
import { type InputSchema, inputSchemaSchema, fingerprintShape } from '../../../backend/src/contracts/processingPlan'
import { LocalArtifacts, readDataFile, normalizeCell } from './executor'
export const LIMITS = { bytes: 50 * 1024 * 1024, rows: 100000, cells: 1000000, datasets: 100, milliseconds: 30000, memoryMb: 256 }
export function digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
export function schemaFingerprint(schema: InputSchema): string {
  // Counts and sample values vary between runs. Dataset identities, columns and types must not.
  return digest(fingerprintShape(schema))
}
function kind(value: unknown): 'null'|'array'|'object'|'string'|'number'|'boolean' { return value === null || value === undefined ? 'null' : Array.isArray(value) ? 'array' : typeof value as 'object'|'string'|'number'|'boolean' }
function structure(value: unknown, depth = 0): unknown {
  if (depth > 4) return kind(value)
  if (Array.isArray(value)) return { array: [...new Set(value.slice(0,3).map(v=>JSON.stringify(structure(v,depth+1))))].sort().map(v=>JSON.parse(v)) }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0,50).map(([k,v])=>[k,structure(v,depth+1)]))
  return kind(value)
}
export class OutputInspector {
  constructor(private artifacts: LocalArtifacts) {}
  async inspect(inputs: Record<string, DataValue>): Promise<{ schema: InputSchema; datasets: Record<string, Row[]>; fingerprint: string }> {
    const schema: InputSchema = { version: 1, datasets: [], warnings: [] }, datasets: Record<string, Row[]> = Object.create(null)
    let bytes = 0, totalRows = 0, cells = 0
    const add = (input: string, index: number, format: InputSchema['datasets'][number]['format'], sheet: string | null, records: unknown[], headers: string[] = [], shape: string | null = null) => {
      const id = `${input}_${index}`
      let rows = records as Row[]
      const names = [...new Set([...headers, ...rows.flatMap(r=>Object.keys(r))])]
      rows = rows.map(row=>Object.fromEntries(names.map(name=>[name,row[name] ?? null])))
      if (names.length > 100) throw new Error('Resource limit: at most 100 columns.')
      totalRows += rows.length; cells += rows.length * names.length
      if (totalRows > LIMITS.rows || cells > LIMITS.cells || schema.datasets.length >= LIMITS.datasets) throw new Error('Resource limit: too many rows, cells, or datasets.')
      const fields = names.map(name=>({ name, types: [...new Set(rows.map(r=>kind(r[name])))].sort() as InputSchema['datasets'][number]['fields'][number]['types'], nullCount: rows.filter(r=>r[name] == null).length }))
      for (const field of fields) if (!field.types.length) field.types = ['null']
      const samples = rows.slice(0,3).map(row=>Object.fromEntries(names.map(name=>{
        const v = row[name]
        const categorical = /^(status|state|payment state|currency)$/i.test(name) && typeof v === 'string' && /^[a-zA-Z _-]{1,24}$/.test(v)
        return [name, v == null ? null : categorical ? v : typeof v === 'number' ? 0 : typeof v === 'boolean' ? v : '[redacted]']
      })))
      schema.datasets.push({ id, input, format, sheet, fields, rowCount: rows.length, samples, structure: shape })
      if (fields.some(f=>f.types.includes('object') || f.types.includes('array'))) schema.warnings.push(`${id}: nested JSON requires configuration; automatic flattening is not supported.`)
      else datasets[id] = rowsSchema.parse(rows)
    }
    for (const [input, output] of Object.entries(inputs)) {
      if (output.type === 'files') {
        if (!output.value.length) throw new Error('No verified downloaded files are available.')
        let index = 0
        for (const file of output.value) {
          bytes += file.bytes
          if (bytes > LIMITS.bytes) throw new Error('Resource limit: combined files exceed 50 MB.')
          const path = await this.artifacts.resolve(file)
          if (file.format === 'xlsx') {
            const book = new ExcelJS.Workbook(); await book.xlsx.readFile(path)
            for (const sheet of book.worksheets) {
              const headers = Array.from({length:sheet.columnCount},(_,i)=>String(normalizeCell(sheet.getRow(1).getCell(i+1).value)??'').trim())
              add(input, index++, 'xlsx', sheet.name, await readDataFile(file, this.artifacts, sheet.name), headers)
            }
          } else if (file.format === 'csv') {
            const matrix = parse(await readFile(path,'utf8'),{ bom:true, skip_empty_lines:true, to:1 }) as string[][]
            add(input,index++,'csv',null,await readDataFile(file,this.artifacts),(matrix[0] ?? []).map(h=>h.trim()))
          } else if (file.format === 'json') {
            const json: unknown = JSON.parse(await readFile(path,'utf8'))
            add(input,index++,'json',null,Array.isArray(json) && json.every(v=>v && typeof v==='object' && !Array.isArray(v)) ? json : json && typeof json==='object' && !Array.isArray(json) ? [json] : [{value:json}],[],JSON.stringify(structure(json)).slice(0,2000))
          } else { const text = await readFile(path,'utf8'); add(input,index++,'text',null,[{text}],['text'],JSON.stringify({contentType:'text/plain',length:text.length,lines:text.split('\n').length})) }
        }
      } else if (output.type === 'rows') add(input,0,'rows',null,output.value)
      else if (output.type === 'json') { const json = output.value; add(input,0,'json',null,Array.isArray(json) && json.every(v=>v && typeof v==='object' && !Array.isArray(v)) ? json : json && typeof json==='object' && !Array.isArray(json) ? [json] : [{value:json}],[],JSON.stringify(structure(json)).slice(0,2000)) }
      else if (output.type === 'text') add(input,0,'text',null,[{text:output.value}],['text'],JSON.stringify({contentType:'text/plain',length:output.value.length,lines:output.value.split('\n').length}))
      else add(input,0,'json',null,[{value:output.value}])
    }
    for (const input of Object.keys(inputs)) {
      const shapes = new Set(schema.datasets.filter(d=>d.input===input).map(d=>JSON.stringify(d.fields.map(f=>[f.name,f.types]))))
      if (shapes.size > 1) schema.warnings.push(`${input}: files/sheets have different column names or types; align them before merging.`)
    }
    inputSchemaSchema.parse(schema)
    return { schema, datasets, fingerprint: schemaFingerprint(schema) }
  }
}
