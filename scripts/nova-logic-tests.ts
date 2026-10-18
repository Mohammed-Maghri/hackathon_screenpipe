import {migrateNovaDemoInventory,novaDemoStock} from '../src/main/novaDemoInventory'
import {postNovaReport,ghostSlackDestination} from '../src/main/screenpipeSlack'
import {buyingPlan,compareRecommendations} from '../src/shared/buyingPlan'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import ExcelJS from 'exceljs'
import {calculateNova} from '../src/main/novaCalculation'
import {NovaPipeline} from '../src/main/novaPipeline'
import {WorkflowScriptStore} from '../src/main/workflowScripts'
import {ResultsStore} from '../src/main/resultsStore'
import {demoWorkflow} from '../src/renderer/src/data/demoDiscovery'
import {upgradeNova} from '../src/renderer/src/data/upgradeNova'
const sales='Order ID,Product ID,Date,Quantity,Status,Window start,Window end\na,p,2026-10-10,14,Paid,2026-10-05,2026-10-18\nb,p,2026-10-10,100,Cancelled,2026-10-05,2026-10-18'
const inventory=(stock:number)=>'Product ID,Product,Stock,Supplier,Unit cost EUR,Lead days,Incoming quantity,Incoming ETA,Planning date,Review days,Safety days,Budget EUR,Window start,Window end\np,Product,'+stock+',Supplier,10,4,2,2026-10-21,2026-10-19,7,2,50,2026-10-05,2026-10-18'
const expected=calculateNova(sales,inventory(1)).result
assert.equal(expected.rows[0].buy,10);assert.equal(expected.total,100);assert.equal(expected.overBudget,true);assert.equal(expected.rows[0].urgent,true)
assert.equal(calculateNova(sales,inventory(50)).result.total,0)
assert.throws(()=>calculateNova(sales.replace('2026-10-05','2026-10-06'),inventory(1)),/periods differ/)
assert.throws(()=>calculateNova(sales,inventory(-1)),/non-negative/)
const root=await mkdtemp(join(tmpdir(),'nova-node-tests-'))
const definition={...demoWorkflow('nova','Prepare report'),id:randomUUID(),updatedAt:new Date().toISOString()}
const graph={...definition,nodes:definition.nodes!,edges:definition.edges!}
const files=join(root,'inputs');await mkdir(files)
await writeFile(join(files,'sales'),sales);await writeFile(join(files,'inventory'),inventory(1))
const reference=new ExcelJS.Workbook();reference.addWorksheet('Shopping list').addRows([['Product','Quantity'],['Demo product',4]]);await reference.xlsx.writeFile(join(files,'excel'))
let mode='ok',calls=0
const store=new WorkflowScriptStore(join(root,'scripts'))
// Browser is deliberately stubbed here; separate Electron acceptance exercises real capture/replay.
const service=new NovaPipeline(join(root,'pipeline'),store,{artifact:async(_r:string,_run:string,id:string)=>join(files,id)} as ResultsStore,async()=>{
 calls++;if(mode==='fail')throw Error('Browser failed')
 return {state:'completed',runId:randomUUID(),recordingId:randomUUID(),completed:1,total:1,sequence:null,action:'Done',artifacts:[{id:'excel',filename:'nova-shopping-list.xlsx',state:'completed',path:'',bytes:1,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',sequence:3},{id:'sales',filename:'nova-restock-sales.csv',state:'completed',path:'',bytes:1,mimeType:'text/csv',sequence:1},...(mode==='missing'?[]:[{id:'inventory',filename:'nova-restock-inventory.csv',state:'completed',path:'',bytes:1,mimeType:'text/csv',sequence:2}])]}
})
await service.configure(graph)
const run=await service.run(graph.id);assert.equal(run.state,'needs_review');assert.equal(run.recommendation?.total,100);assert.equal(run.files.length,7);assert.ok(run.draft?.includes('€100.00'))
for(let index=1;index<run.nodes.length;index++)assert.deepEqual(run.nodes[index].input,run.nodes[index-1].output)
assert.ok(run.nodes[2].outputFileIds?.length)
assert.ok(run.nodes[3].outputFileIds?.length===3)
assert.deepEqual(run.nodes[5].output,{approval:'pending',messageSent:false})
const parsedExport=run.files.find(f=>f.name==='browser-exports.json')!
assert.ok(parsedExport)
const parsedJSON=JSON.parse(await service.preview(run.id,parsedExport.id))
assert.equal(parsedJSON.browserRunId,run.browserRunId)
assert.equal(parsedJSON.data.sales[0]['Product ID'],'p')
assert.equal(parsedJSON.data.sales[0].Quantity,'14')
assert.equal(parsedJSON.data.inventory[0].Stock,'1')
assert.equal(parsedJSON.sourceFiles.length,2)
assert.deepEqual(parsedJSON.data.workbook.sheets[0].rows,[['Product','Quantity'],['Demo product','4']])
const xlsx=run.files.find(f=>f.name.endsWith('.xlsx'))!;const book=new ExcelJS.Workbook();await book.xlsx.readFile(await service.artifact(run.id,xlsx.id));assert.equal(book.getWorksheet('Shopping list')?.rowCount,2)
assert.equal(run.sources?.length,2)
assert.equal(await service.preview(run.id,run.sources![0].id),sales)
const snapshot=await service.artifact(run.id,run.sources![0].id);await writeFile(snapshot,'changed');await assert.rejects(()=>service.preview(run.id,run.sources![0].id),/changed on disk/);await writeFile(snapshot,sales)
const allocation=buyingPlan(expected,50);assert.equal(allocation.total,50);assert.equal(allocation.rows[0].quantity,5);assert.equal(allocation.unfundedUnits,5)
assert.equal(buyingPlan(expected,0).total,0)
const mixed={...expected,rows:[{...expected.rows[0],id:'normal',urgent:false,stock:50},{...expected.rows[0],id:'urgent',urgent:true,stock:0}]}
assert.equal(buyingPlan(mixed,50).rows.find(r=>r.id==='urgent')?.quantity,5)
assert.equal(buyingPlan(mixed,50).rows.find(r=>r.id==='normal')?.quantity,0)

assert.throws(()=>buyingPlan(expected,50,{p:-1}),/whole numbers/)
assert.throws(()=>buyingPlan(expected,50,{other:1}),/Unknown product/)
const scenario=await service.saveScenario({runId:run.id,budget:50});assert.equal(scenario.plan.total,50);assert.equal(scenario.files.length,3)
assert.equal((await service.list()).runs[0].recommendation!.total,100)
await service.approveScenario({runId:run.id,scenarioId:scenario.id});assert.ok((await service.list()).runs[0].scenarios![0].approvedAt)
const manual=await service.saveScenario({runId:run.id,budget:20,quantities:{p:4}});assert.equal(manual.plan.total,40);assert.ok(!manual.approvedAt)
await assert.rejects(()=>service.approveScenario({runId:randomUUID(),scenarioId:scenario.id}),/not found/)
assert.ok((await service.preview(run.id,manual.files.find(f=>f.name.endsWith('.json'))!.id)).includes('sourceFiles'))
await service.approve(run.id);assert.equal((await service.list()).runs[0].state,'approved')
await writeFile(join(files,'inventory'),inventory(50));const changed=await service.run(graph.id);assert.equal(changed.recommendation?.total,0);assert.equal(compareRecommendations(changed.recommendation!,run.recommendation!)[0].delta,-10)
mode='fail';const failed=await service.run(graph.id);assert.equal(failed.state,'failed');assert.equal(failed.files.length,0);assert.equal(failed.nodes[2].state,'pending')
mode='missing';const missing=await service.run(graph.id);assert.equal(missing.state,'failed');assert.equal(missing.nodes[3].state,'pending');assert.ok(!missing.files.some(f=>f.name.endsWith('.xlsx')))
await assert.rejects(()=>service.approve(missing.id),/awaiting review/)
mode='ok';const now=Date.now();await service.scheduleTests(graph.id,now);await Promise.all([service.tick(now+180000),service.tick(now+180000)]);await service.tick(now+180000);await service.tick(now+180000);assert.equal((await service.list()).schedules.filter(s=>s.state==='done').length,3);assert.equal(calls,7)
const reopened=new NovaPipeline(join(root,'pipeline'),store,{} as ResultsStore,async()=>{throw Error('Must not replay on load')});assert.equal((await reopened.list()).runs.length,7)
const oldNodes=[graph.nodes[0],graph.nodes[1],graph.nodes[2],graph.nodes[5],graph.nodes[4]].map((n,i)=>({...n,config:{...n.config,novaOperation:undefined,order:i,stepType:i===4?'integration':n.config.stepType}}))
const old={...definition,nodes:oldNodes,edges:oldNodes.slice(1).map((n,i)=>({id:randomUUID(),sourceNodeId:oldNodes[i].id,targetNodeId:n.id}))}
const upgraded=upgradeNova(old)!;assert.equal(upgraded.nodes.length,6);assert.equal(upgraded.nodes[1].id,oldNodes[1].id);assert.equal(upgraded.nodes[1].config.startUrl,oldNodes[1].config.startUrl);assert.equal(upgradeNova({...old,edges:[]}),null)
console.log('PASS: demand/stock/incoming/budget arithmetic, changed inputs, Excel output, draft, approval, failure stops, no stale output, three schedules, restart persistence, upgrade preserves browser identity.')

const original={products:Object.entries({hoodie:47,tee:126,cargo:18,cap:8,shoes:24}).map(([id,stock])=>({id,stock})),orders:[{id:'preserve'}]}
const migrated=JSON.parse(migrateNovaDemoInventory(JSON.stringify(original))!)
assert.deepEqual(migrated.orders,original.orders)
assert.deepEqual(migrated.products.map((p:{stock:number})=>p.stock),Object.values(novaDemoStock))
assert.equal(migrateNovaDemoInventory(JSON.stringify(migrated)),null)
original.products[0].stock=45
assert.equal(migrateNovaDemoInventory(JSON.stringify(original)),null)
process.env.SCREENPIPE_LOCAL_API_KEY='test-only'
process.env.SCREENPIPE_LOCAL_API_URL='http://localhost:3030'
let dispatches=0,posts=0
const mockFetch=(async(_url:unknown,options?:RequestInit)=>{
 if(options?.method==='POST'){posts++;assert.equal(dispatches,1);const body=JSON.parse(options.body as string);assert.equal(body.channel,ghostSlackDestination.channel);assert.equal(body.instance,ghostSlackDestination.workspace);return Response.json({ok:true,channel:body.channel,ts:'123.456'})}
 return Response.json({ok:true,channels:[{id:ghostSlackDestination.channel,name:'daily-reports',context_team_id:ghostSlackDestination.workspace,is_archived:false}]})
}) as typeof fetch
assert.equal((await postNovaReport('Verified sandbox report',new AbortController().signal,async()=>{dispatches++},mockFetch)).ts,'123.456')
assert.equal(posts,1)
await assert.rejects(()=>postNovaReport('Report',new AbortController().signal,async()=>{throw Error('Must not dispatch')},(async()=>Response.json({ok:true,channels:[]})) as typeof fetch),/not found/)
await assert.rejects(()=>postNovaReport('Report',new AbortController().signal,async()=>{},(async(_url,options)=>options?.method==='POST'?Response.json({ok:true}):mockFetch(_url,options)) as typeof fetch),/receipt/)
console.log('PASS: sandbox migration preserves edits, Slack destination verification, delivery receipt, missing-channel rejection, uncertain-send rejection.')
