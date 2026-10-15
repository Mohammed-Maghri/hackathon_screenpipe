import { type ProcessingPlan, type InputSchema, type ExpectedOutput, validatePlan } from '../../../backend/src/contracts/processingPlan'
import { handlers, LocalArtifacts } from './executor'
import { type Row, type DataValue, rowsSchema } from '../../shared/dataProcessing'
import { LIMITS } from './outputInspector'
export async function executePlan(plan: ProcessingPlan, schema: InputSchema, expected: ExpectedOutput, datasets: Record<string, Row[]>, artifacts: LocalArtifacts): Promise<Record<string, DataValue>> {
  const schemas = validatePlan(plan, schema, expected)
  const values = new Map(Object.entries(datasets)); let files: DataValue | undefined; const started = Date.now()
  for (const step of plan.steps) {
    let rows = values.get(step.source)
    if (!rows) throw new Error(`Unsupported or missing dataset ${step.source}. Configure a supported flat dataset.`)
    const other = 'other' in step ? values.get(step.other) : undefined
    const run = async (operation: keyof typeof handlers, rules: Record<string, unknown>, comparison?: Row[]) => {
      const outputs = await handlers[operation]({ rows: {type:'rows',value:rows!}, ...(comparison ? { comparison: {type:'rows' as const,value:comparison} } : {}) }, {version:1,operation,inputs:{},rules,...(step.type==='export'?{output:{filename:step.filename}}:{})},artifacts)
      if (outputs.files) files=outputs.files
      return outputs.rows?.type==='rows' ? outputs.rows.value : rows!
    }
    switch(step.type) {
      case 'read': break
      case 'filter': rows=await run('filter_rows',{predicates:[{column:step.column,operator:step.operator,value:step.value}],mode:'all'}); break
      case 'select': rows=rows.map(r=>Object.fromEntries(step.columns.map(c=>[c,r[c]]))); break
      case 'rename': rows=rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[step.columns.find(c=>c.from===k)?.to??k,v]))); break
      case 'transform': rows=rows.map(r=>{ const value=r[step.column]; if(value===null)return r; let changed: Row[string]; if(step.transform==='number'){changed=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN;if(!Number.isFinite(changed))throw new Error(`Invalid numeric value in ${step.column}`)}else{const text=String(value);changed=step.transform==='trim'?text.trim():step.transform==='uppercase'?text.toUpperCase():step.transform==='lowercase'?text.toLowerCase():text}return {...r,[step.column]:changed} });break
      case 'merge': if(!other)throw new Error('Missing merge dataset');rows=rows.concat(other);break
      case 'join': {
        if(!other)throw new Error('Missing join dataset')
        const index=new Map<string,Row[]>();for(const row of other){const key=JSON.stringify(row[step.rightKey]);const group=index.get(key)??[];group.push(row);index.set(key,group)}
        const result:Row[]=[];const rightFields=schemaFields(plan,schema,step.other,other)
        for(const row of rows){const matches=index.get(JSON.stringify(row[step.leftKey]))??[];for(const match of matches.length?matches:step.mode==='left'?[Object.fromEntries(rightFields.map(k=>[k,null]))]:[]){result.push({...row,...Object.fromEntries(Object.entries(match).map(([k,v])=>[step.prefix+k,v]))});if(result.length>LIMITS.rows)throw new Error('Resource limit: join result exceeds row limit.')}}rows=result;break
      }
      case 'aggregate':rows=await run('aggregate',{groupBy:step.groupBy,...(step.column?{column:step.column}:{}),calculation:step.calculation});break
      case 'duplicates':rows=await run('find_duplicates',{keys:step.keys});break
      case 'compare':if(!other)throw new Error('Missing reference dataset');rows=await run('compare_datasets',{keys:step.keys},other);break
      case 'export':await run('generate_report',{columns:schemaFields(plan,schema,step.source,rows)});break
    }
    const fields=schemas.get(step.id)!
    for(const row of rows){
      if(Object.keys(row).length!==fields.length)throw new Error(`Output schema mismatch in ${step.id}`)
      for(const field of fields){const value=row[field.name],type=value===null?'null':typeof value;if(!field.types.includes(type as typeof field.types[number]))throw new Error(`Invalid output type for ${step.id}.${field.name}`)}
    }
    rowsSchema.parse(rows)
    if(rows.length>LIMITS.rows||rows.reduce((n,r)=>n+Object.keys(r).length,0)>LIMITS.cells||Date.now()-started>LIMITS.milliseconds)throw new Error('Processing resource limit exceeded.')
    values.set(step.id,rows)
  }
  const rows=values.get(plan.steps.at(-1)!.id)!
  return {rows:{type:'rows',value:rows},count:{type:'number',value:rows.length},...(files?{files}:{})}
}
function schemaFields(plan:ProcessingPlan,schema:InputSchema,source:string,rows:Row[]):string[]{
  if(rows.length)return [...new Set(rows.flatMap(Object.keys))]
  const fields=new Map(schema.datasets.map(d=>[d.id,d.fields.map(f=>f.name)]))
  for(const step of plan.steps){let names=fields.get(step.source)??[];if(step.type==='select')names=step.columns;if(step.type==='rename')names=names.map(n=>step.columns.find(c=>c.from===n)?.to??n);if(step.type==='aggregate')names=[...step.groupBy,'result'];if(step.type==='join')names=[...names,...(fields.get(step.other)??[]).map(n=>step.prefix+n)];fields.set(step.id,names)}
  return fields.get(source)??[]
}
