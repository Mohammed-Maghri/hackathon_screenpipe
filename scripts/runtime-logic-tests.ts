import { inferPromptOutput, promptConfig } from '../src/renderer/src/data/promptProcessing'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { LocalArtifacts } from '../src/main/dataProcessing/executor'
import { OutputInspector, LIMITS } from '../src/main/dataProcessing/outputInspector'
import { executePlan } from '../src/main/dataProcessing/planExecutor'
import { runProcessingWorker } from '../src/main/dataProcessing/runWorker'
import { planSchema, validatePlan, type ProcessingPlan, type ExpectedOutput } from '../src/shared/processingPlan'
import { type DataValue } from '../src/shared/dataProcessing'
const root=await mkdtemp(join(tmpdir(),'ghost-runtime-logic-')),artifacts=new LocalArtifacts(join(root,'outputs'))
async function workbook(name:string,headers:string[],rows:unknown[][]){const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Transactions');sheet.addRow(headers);sheet.addRows(rows);const path=join(root,name);await book.xlsx.writeFile(path);return artifacts.register(path,root)}
const file1=await workbook('one.xlsx',['Reference','Payment State','Total EUR'],[['A','Failed',12],['B','Paid',30],['A','Failed',12]])
const file2=await workbook('two.xlsx',['Reference','Payment State','Total EUR'],[['C','Failed',20]])
const inputs:Record<string,DataValue>={reports:{type:'files',value:[file1,file2]}}
const inspector=new OutputInspector(artifacts),inspected=await inspector.inspect(inputs)
assert.equal(inspected.schema.datasets.length,2);assert.equal(inspected.schema.datasets[0].rowCount,3)
assert.equal(inspected.schema.datasets[0].sheet,'Transactions')
assert.equal(inspected.schema.datasets[0].samples[0].Reference,'[redacted]');assert.equal(inspected.schema.datasets[0].samples[0]['Total EUR'],0)
assert.equal(inspected.schema.datasets[0].samples[0]['Payment State'],'Failed')
const expected:ExpectedOutput={format:'xlsx',filename:'failed.xlsx'}
const plan:ProcessingPlan={version:1,steps:[{id:'read',type:'read',source:'reports_0'},{id:'merged',type:'merge',source:'read',other:'reports_1'},{id:'failed',type:'filter',source:'merged',column:'Payment State',operator:'eq',value:'Failed'},{id:'exported',type:'export',source:'failed',filename:'failed.xlsx'}]}
validatePlan(plan,inspected.schema,expected)
const result=await runProcessingWorker(artifacts,inputs,{plan,expectedOutput:expected,fingerprint:inspected.fingerprint})
assert.equal(result.outputs!.count.value,3);artifacts.restore(result.manifest!)
const files=result.outputs!.files;if(files.type!=='files')throw Error('Missing artifact')
const actual=new ExcelJS.Workbook();await actual.xlsx.readFile(await artifacts.resolve(files.value[0]))
assert.equal(actual.worksheets[0].rowCount,4);assert.deepEqual(actual.worksheets[0].getRow(2).values,[,'A','Failed',12]);assert.deepEqual(actual.worksheets[0].getRow(4).values,[,'C','Failed',20])
console.log('PASS real XLSX inspection, redacted preview, approved-plan worker execution and actual report contents')
const rowsOutput:ExpectedOutput={format:'rows',filename:null}
const run=async(steps:ProcessingPlan['steps'])=>executePlan({version:1,steps},inspected.schema,rowsOutput,inspected.datasets,artifacts)
assert.equal((await run([{id:'duplicates',type:'duplicates',source:'reports_0',keys:['Reference']}])).count.value,1)
assert.deepEqual((await run([{id:'sum',type:'aggregate',source:'reports_0',groupBy:[],column:'Total EUR',calculation:'sum'}])).rows.value,[{result:54}])
assert.equal((await run([{id:'difference',type:'compare',source:'reports_0',other:'reports_1',keys:['Reference']}])).count.value,3)
assert.deepEqual((await run([{id:'selected',type:'select',source:'reports_1',columns:['Reference']},{id:'renamed',type:'rename',source:'selected',columns:[{from:'Reference',to:'ID'}]},{id:'lowered',type:'transform',source:'renamed',column:'ID',transform:'lowercase'}])).rows.value,[{ID:'c'}])
assert.equal((await run([{id:'joined',type:'join',source:'reports_0',other:'reports_1',leftKey:'Reference',rightKey:'Reference',mode:'left',prefix:'expected_'}])).count.value,3)
await assert.rejects(()=>run([{id:'missing',type:'compare',source:'reports_0',other:'invented_reference',keys:['Reference']}]),/reference|dataset/)
await assert.rejects(()=>run([{id:'missing',type:'filter',source:'reports_0',column:'Invented',operator:'eq',value:'x'}]),/Unknown input column/)
assert.throws(()=>planSchema.parse({version:1,steps:[{id:'evil',type:'script',source:'reports_0',code:'process.exit()'}]}))
assert.throws(()=>validatePlan({version:1,steps:[{id:'exported',type:'export',source:'reports_0',filename:'wrong.xlsx'}]},inspected.schema,expected),/expected output/)
const different=await workbook('different.xlsx',['ID','State','Amount'],[['D','Failed',10]])
const changed=await inspector.inspect({reports:{type:'files',value:[file1,different]}})
assert.notEqual(changed.fingerprint,inspected.fingerprint);assert.ok(changed.schema.warnings.length)
await assert.rejects(()=>runProcessingWorker(artifacts,{reports:{type:'files',value:[file1,different]}},{plan,expectedOutput:expected,fingerprint:inspected.fingerprint}),/schema changed/)
assert.throws(()=>validatePlan(plan,changed.schema,expected),/matching schemas/)
const newer=await workbook('newer.xlsx',['Reference','Payment State','Total EUR'],[['Z','Paid',3],['D','Failed',9]])
assert.equal((await inspector.inspect({reports:{type:'files',value:[file1,newer]}})).fingerprint,inspected.fingerprint)
console.log('PASS select/rename/transform/merge/join/aggregate/duplicates/compare, invented columns/references, unsupported code, schema drift and stable schemas with new rows')
const empty=await workbook('empty.xlsx',['Reference','Payment State','Total EUR'],[])
const emptyResult=await inspector.inspect({reports:{type:'files',value:[empty]}})
assert.equal(emptyResult.schema.datasets[0].rowCount,0);assert.equal(emptyResult.schema.datasets[0].fields.length,3)
const emptyPlan:ProcessingPlan={version:1,steps:[{id:'exported',type:'export',source:'reports_0',filename:'failed.xlsx'}]}
assert.equal((await executePlan(emptyPlan,emptyResult.schema,expected,emptyResult.datasets,artifacts)).count.value,0)
await writeFile(join(root,'broken.xlsx'),'broken');const broken=await artifacts.register(join(root,'broken.xlsx'),root)
await assert.rejects(()=>inspector.inspect({files:{type:'files',value:[broken]}}))
await assert.rejects(()=>inspector.inspect({files:{type:'files',value:[]}}),/No verified/)
await assert.rejects(()=>inspector.inspect({files:{type:'files',value:[{...file1,id:crypto.randomUUID()}]}}),/Unknown/)
await writeFile(join(root,'numeric.csv'),'id,amount\nA,not-a-number\n')
const csv=await artifacts.register(join(root,'numeric.csv'),root),csvInspection=await inspector.inspect({data:{type:'files',value:[csv]}})
await assert.rejects(()=>executePlan({version:1,steps:[{id:'cast',type:'transform',source:'data_0',column:'amount',transform:'number'}]},csvInspection.schema,rowsOutput,csvInspection.datasets,artifacts),/Invalid numeric/)
const largeRows=Array.from({length:100001},()=>({id:1}))
await assert.rejects(()=>inspector.inspect({rows:{type:'rows',value:largeRows}}),/Resource limit/)
await assert.rejects(()=>inspector.inspect({files:{type:'files',value:[{...file1,bytes:LIMITS.bytes+1}]}}),/50 MB/)
const json=await inspector.inspect({json:{type:'json',value:{id:1,details:{type:'A'}}},text:{type:'text',value:'Hello\nWorld'}})
assert.ok(json.schema.datasets[0].fields.some(f=>f.name==='details'&&f.types.includes('object')))
assert.ok(json.schema.datasets[1].structure?.includes('text/plain'))
assert.equal(json.schema.datasets[1].samples[0].text,'[redacted]')
console.log('PASS empty/header-only sheets, invalid spreadsheets/types, missing artifacts, row/file limits and JSON/text structure inspection')
// CSV export is re-read and formula-like strings are escaped, not executed.
const csvPlan:ProcessingPlan={version:1,steps:[{id:'out',type:'export',source:'reports_0',filename:'report.csv'}]}
const csvOutput=await executePlan(csvPlan,inspected.schema,{format:'csv',filename:'report.csv'},inspected.datasets,artifacts)
if(csvOutput.files.type!=='files')throw Error('No CSV')
assert.ok((await readFile(await artifacts.resolve(csvOutput.files.value[0]),'utf8')).includes('A,Failed,12'))
console.log('PASS generated CSV actual output contents')

assert.deepEqual(inferPromptOutput('Convert the downloaded Excel file to CSV'),{format:'csv',filename:'report.csv'})
assert.deepEqual(inferPromptOutput('Read the downloaded CSV into invoice rows and return the row count.'),{format:'rows',filename:null})
assert.deepEqual(inferPromptOutput('Keep failed rows. Export failed.xlsx.'),{format:'xlsx',filename:'failed.xlsx'})
const emptyConfig={version:1 as const,mode:'generated' as const,operation:'read_files' as const,inputs:{},rules:{}}
const simpleGraph={nodes:[{id:'download',config:{stepType:'browser'}},{id:'process',config:{stepType:'data_processing',dataProcessing:emptyConfig}}],edges:[{sourceNodeId:'download',targetNodeId:'process'}]}
const inferred=promptConfig(emptyConfig,simpleGraph,'process','Convert to CSV')
assert.deepEqual(inferred.inputs,{input:{nodeId:'download',output:'files',type:'files'}})
assert.equal(inferred.expectedOutput?.format,'csv')
assert.deepEqual(promptConfig({...emptyConfig,inferOutput:false,expectedOutput:{format:'xlsx',filename:'custom.xlsx'}},simpleGraph,'process','Convert to CSV').expectedOutput,{format:'xlsx',filename:'custom.xlsx'})
assert.deepEqual(promptConfig(emptyConfig,{...simpleGraph,nodes:[...simpleGraph.nodes,{id:'second',config:{stepType:'browser'}}],edges:[...simpleGraph.edges,{sourceNodeId:'second',targetNodeId:'process'}]},'process','Convert to CSV').inputs,{})
console.log('PASS prompt output formats, automatic upstream binding, explicit output overrides and ambiguous branch handling')
// CSV and Excel -> actual JSON artifacts -> downstream typed datasets.
await writeFile(join(root,'invoices.csv'),'id,amount,status\nA,12,unpaid\nB,30,paid\n')
const invoices=await artifacts.register(join(root,'invoices.csv'),root)
const invoiceInputs:Record<string,DataValue>={files:{type:'files',value:[invoices]}}
const jsonExpected:ExpectedOutput={format:'json',filename:'invoices.json'}
const jsonPlan:ProcessingPlan={version:1,steps:[{id:'read',type:'read',source:'files_0'},{id:'number',type:'transform',source:'read',column:'amount',transform:'number'},{id:'out',type:'export',source:'number',filename:'invoices.json'}]}
const jsonRun=await runProcessingWorker(artifacts,invoiceInputs,{plan:jsonPlan,expectedOutput:jsonExpected})
artifacts.restore(jsonRun.manifest!)
if(jsonRun.outputs?.files.type!=='files')throw Error('JSON artifact missing')
const jsonRows=JSON.parse(await readFile(await artifacts.resolve(jsonRun.outputs.files.value[0]),'utf8'))
assert.deepEqual(jsonRows,[{id:'A',amount:12,status:'unpaid'},{id:'B',amount:30,status:'paid'}])
const downstream=await inspector.inspect({files:jsonRun.outputs.files})
assert.deepEqual(downstream.datasets.files_0,jsonRows)
assert.deepEqual((await executePlan({version:1,steps:[{id:'sum',type:'aggregate',source:'files_0',groupBy:[],column:'amount',calculation:'sum'}]},downstream.schema,rowsOutput,downstream.datasets,artifacts)).rows.value,[{result:42}])
const emptyJson=await executePlan({version:1,steps:[{id:'out',type:'export',source:'reports_0',filename:'empty.json'}]},emptyResult.schema,{format:'json',filename:'empty.json'},emptyResult.datasets,artifacts)
if(emptyJson.files.type!=='files')throw Error('Empty JSON artifact missing')
assert.deepEqual(JSON.parse(await readFile(await artifacts.resolve(emptyJson.files.value[0]),'utf8')),[])
const excelJson=await executePlan({version:1,steps:[{id:'out',type:'export',source:'reports_0',filename:'excel.json'}]},inspected.schema,{format:'json',filename:'excel.json'},inspected.datasets,artifacts)
if(excelJson.files.type!=='files')throw Error('Excel JSON missing')
assert.deepEqual(JSON.parse(await readFile(await artifacts.resolve(excelJson.files.value[0]),'utf8')),inspected.datasets.reports_0)
assert.deepEqual(inferPromptOutput('Convert these CSV files into JSON format rows'),{format:'json',filename:'report.json'})
assert.deepEqual(inferPromptOutput('Export invoices.json'),{format:'json',filename:'invoices.json'})
console.log('PASS actual CSV/XLSX → JSON files, numeric values, empty arrays, downstream JSON reload and total 42, prompt format inference')
