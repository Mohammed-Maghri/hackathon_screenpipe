import type {postNovaReport} from './screenpipeSlack'
import {novaDiscoveryDemo} from '../shared/novaDiscoveryDemo'
import {buyingPlan,buyingPlanRows} from '../shared/buyingPlan'
import type {BuyingScenario} from '../shared/novaPipeline'
import {randomUUID,createHash} from 'node:crypto'
import {mkdir,readFile,writeFile,rename,realpath,stat} from 'node:fs/promises'
import {join,relative} from 'node:path'
import {z} from 'zod'
import ExcelJS from 'exceljs'
import {novaOperations,type NovaWorkflow,type NovaRun,type NovaSchedule} from '../shared/novaPipeline'
import {shoppingRows} from '../shared/novaRestocking'
import {calculateNova} from './novaCalculation'
import {WorkflowScriptStore} from './workflowScripts'
import {ResultsStore} from './resultsStore'
import type {ReplayStatus} from '../shared/recording'
const uuid=z.string().uuid()
const schema=z.object({id:uuid,name:z.string().min(1).max(500),nodes:z.array(z.object({id:uuid,label:z.string().max(500),config:z.record(z.string(),z.unknown())})).length(6),edges:z.array(z.object({sourceNodeId:uuid,targetNodeId:uuid})).length(5)})
type BrowserRunner=(workflow:string,node:string,url:string,signal:AbortSignal)=>Promise<ReplayStatus>
export class NovaPipeline {
 private workflows:NovaWorkflow[]=[]
 private runs:NovaRun[]=[]
 private schedules:NovaSchedule[]=[]
 private active:{id:string;controller:AbortController}|null=null
 private ticking=false
 private writes=Promise.resolve()
 readonly ready:Promise<void>
 constructor(private root:string,private scripts:WorkflowScriptStore,private results:ResultsStore,private browser:BrowserRunner,private deliver?:typeof postNovaReport){this.ready=this.load()}
 private async load(){
  await mkdir(this.root,{recursive:true,mode:0o700})
  try{const saved=JSON.parse(await readFile(join(this.root,'state.json'),'utf8'));this.workflows=saved.workflows;this.runs=saved.runs;this.schedules=saved.schedules
   for(const run of this.runs){if(run.delivery?.state==='sending')run.delivery.state='unknown'}
   for(const run of this.runs)if(run.state==='running'){run.state='failed';run.error='App stopped during execution. Inspect the browser outcome before starting a new run.';run.finishedAt=new Date().toISOString()}
   for(const item of this.schedules)if(item.state==='running'){item.state='failed';item.error='Interrupted; not automatically retried.'}
   await this.save()
  }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
 }
 private save(){const text=JSON.stringify({workflows:this.workflows,runs:this.runs,schedules:this.schedules},null,2);const next=this.writes.then(async()=>{const temp=join(this.root,randomUUID()+'.tmp');await writeFile(temp,text,{mode:0o600});await rename(temp,join(this.root,'state.json'))});this.writes=next.catch(()=>{});return next}
 async configure(raw:unknown){await this.ready;const graph=schema.parse(raw)
  const ordered=novaOperations.map(operation=>{const matches=graph.nodes.filter(n=>n.config.novaOperation===operation);if(matches.length!==1)throw Error('NOVA requires one node for each supported operation.');return matches[0]})
  if(new Set(ordered.map(n=>n.id)).size!==6||graph.edges.some((edge)=>!ordered.slice(1).some((node,i)=>node.id===edge.targetNodeId&&ordered[i].id===edge.sourceNodeId))||new Set(graph.edges.map(e=>e.sourceNodeId)).size!==5)throw Error('Use the supported sequential NOVA graph.')
  const browser=ordered[1];if(browser.config.startUrl!=='https://hackathon-screenpipe.vercel.app/nova/restocking')throw Error('NOVA runner requires the hosted NOVA restocking task.')
  if(this.active&&this.runs.find(r=>r.id===this.active!.id)?.workflowId===graph.id)throw Error('Wait for the active run before changing its definition.')
  const snapshot={...graph,nodes:ordered};await this.scripts.generate(snapshot)
  this.workflows=this.workflows.filter(w=>w.id!==graph.id).concat(snapshot);await this.save()
 }
 async list(){await this.ready;return structuredClone({runs:[...this.runs].reverse(),schedules:this.schedules,workflows:this.workflows.map(w=>({id:w.id,name:w.name}))})}
 async has(id:string){await this.ready;return this.workflows.some(w=>w.id===id)}
 async remove(id:string){await this.ready;uuid.parse(id);if(this.active&&this.runs.find(r=>r.id===this.active!.id)?.workflowId===id)throw Error('Cancel the active run first.');this.workflows=this.workflows.filter(w=>w.id!==id);for(const s of this.schedules)if(s.workflowId===id&&s.state==='scheduled')s.state='cancelled';await this.save()}
 async scheduleTests(id:string,now=Date.now()){await this.ready;uuid.parse(id);if(!await this.has(id))throw Error('Prepare the NOVA workflow first.');if(this.schedules.some(s=>s.workflowId===id&&['scheduled','running'].includes(s.state)))throw Error('Finish or cancel the existing test schedules first.');const schedules=[1,2,3].map(n=>({id:randomUUID(),workflowId:id,label:`NOVA test ${n}`,dueAt:new Date(now+n*60000).toISOString(),state:'scheduled' as const}));this.schedules.push(...schedules);await this.save();return schedules}
 async cancelSchedule(id:string){await this.ready;const item=this.schedules.find(s=>s.id===uuid.parse(id));if(!item||item.state!=='scheduled')throw Error('Only pending schedules can be cancelled.');item.state='cancelled';await this.save()}
 async cancelRun(id:string){await this.ready;if(this.active?.id!==uuid.parse(id))throw Error('Run is not active.');this.active.controller.abort()}
 async tick(now=Date.now()){await this.ready;if(this.active||this.ticking)return;this.ticking=true;try{const item=this.schedules.find(s=>s.state==='scheduled'&&Date.parse(s.dueAt)<=now);if(!item)return;item.state='running';await this.save();try{const run=await this.run(item.workflowId);item.runId=run.id;item.state=run.state==='needs_review'?'done':'failed';item.error=run.error}catch(error){item.state='failed';item.error=error instanceof Error?error.message:'Run failed.'}await this.save()}finally{this.ticking=false}}
 async run(id:string):Promise<NovaRun>{await this.ready;uuid.parse(id);if(this.active)throw Error('Another NOVA run is active. Wait or cancel it first.');if(this.runs.some(r=>r.workflowId===id&&r.delivery?.state==='unknown'))throw Error('A previous Slack send has an unknown outcome. Check #daily-reports and resolve its delivery receipt before running again.');const workflow=structuredClone(this.workflows.find(w=>w.id===id));if(!workflow)throw Error('Prepare this NOVA workflow first.')
  const controller=new AbortController(),run:NovaRun={id:randomUUID(),workflowId:id,workflowName:workflow.name,startedAt:new Date().toISOString(),state:'running',nodes:workflow.nodes.map((n,i)=>({id:n.id,label:n.label,operation:novaOperations[i],state:'pending'})),files:[]}
  this.active={id:run.id,controller};this.runs.push(run)
  let browserResult:ReplayStatus|undefined
  let calculated:ReturnType<typeof calculateNova>|undefined
  const directory=join(this.root,run.id)
  const file=async(name:string,contents:string|Uint8Array)=>{const id=randomUUID();await writeFile(join(directory,id+'-'+name),contents,{mode:0o600});run.files.push({id,name});return id}
  try{await this.save();await mkdir(directory,{mode:0o700});const pack=await this.scripts.generate(workflow);run.scriptRevision=pack.revision
   for(const [index,node] of run.nodes.entries()){
    controller.signal.throwIfAborted();node.input=index===0?{workflowId:workflow.id,workflowName:workflow.name}:structuredClone(run.nodes[index-1].output??null);node.state='running';await this.save()
    const source=await this.scripts.read(id,pack.revision,pack.nodes[index].file)
    if(createHash('sha256').update(source).digest('hex')!==pack.fileHashes?.[pack.nodes[index].file])throw Error('Generated script integrity check failed.')
    // Import the exact verified bytes, avoiding a file-change race after verification.
    const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
    const readBrowserExport=async(name:string)=>{const matches=browserResult!.artifacts?.filter(f=>f.filename===name&&f.state==='completed')??[];if(matches.length!==1)throw Error('Expected one completed '+name);const path=await this.results.artifact(run.recordingId!,run.browserRunId!,matches[0].id);if((await stat(path)).size>2_000_000)throw Error('Export exceeds size limit.');const text=await readFile(path,'utf8');const sourceId=await file(name,text);(run.sources??=[]).push({id:sourceId,name,sha256:createHash('sha256').update(text).digest('hex'),bytes:Buffer.byteLength(text)});return text}
    if(node.operation==='calculate'){
     if(!browserResult||!run.recordingId||!run.browserRunId)throw Error('Fresh browser outputs are missing.')
     const salesCSV=await readBrowserExport('nova-restock-sales.csv')
     const inventoryCSV=await readBrowserExport('nova-restock-inventory.csv')
     // Validate planning data before publishing a successful conversion artifact.
     calculated=calculateNova(salesCSV,inventoryCSV)
     const matches=browserResult.artifacts?.filter(item=>item.filename==='nova-shopping-list.xlsx'&&item.state==='completed')??[]
     if(matches.length>1)throw Error('Expected one reference Excel workbook.')
     const workbookPath=matches.length?await this.results.artifact(run.recordingId,run.browserRunId,matches[0].id):undefined
     const sourcePath=(name:string)=>{const source=run.sources!.find(item=>item.name===name)!;return join(directory,source.id+'-'+name)}
     const outputId=randomUUID(),outputName='browser-exports.json',outputPath=join(directory,outputId+'-'+outputName)
     await module.run({salesPath:sourcePath('nova-restock-sales.csv'),inventoryPath:sourcePath('nova-restock-inventory.csv'),workbookPath,outputPath,browserRunId:run.browserRunId,sourceFiles:run.sources})
     run.files.push({id:outputId,name:outputName})
     run.settings=calculated.settings;run.recommendation=calculated.result
     node.detail=`Converted browser exports to JSON and calculated ${calculated.result.rows.length} products locally.`
    }else await module.run({nova:{
     execute:async(descriptor:{nodeId:string;config:{novaOperation:string}})=>{
     if(descriptor.nodeId!==node.id||descriptor.config.novaOperation!==node.operation)throw Error('Script descriptor mismatch.')
     switch(node.operation){
      case 'request':node.detail='Prepared discovery context mapped to the saved workflow. No live Screenpipe search or AI call.';break
      case 'browser':{
       browserResult=await this.browser(id,node.id,String(workflow.nodes[index].config.startUrl),controller.signal)
       if(browserResult.state!=='completed'||!browserResult.runId||!browserResult.recordingId)throw Error('Browser did not return a verified run.')
       run.browserRunId=browserResult.runId;run.recordingId=browserResult.recordingId;node.detail='Browser actions verified; fresh exports registered to this run.';break
      }
      case 'report':{
       if(!calculated)throw Error('Calculation is missing.');const rows=shoppingRows(calculated.result),workbook=new ExcelJS.Workbook();workbook.addWorksheet('Shopping list').addRows(rows);workbook.addWorksheet('Assumptions').addRows(Object.entries(calculated.settings));workbook.addWorksheet('Sources').addRows([['Run ID',run.id],['Browser run ID',run.browserRunId??''],['Source file','SHA-256'],...(run.sources??[]).map(source=>[source.name,source.sha256])]);await file('ghost-nova-shopping-list.xlsx',new Uint8Array(await workbook.xlsx.writeBuffer()));
       const escape=(value:string|number)=>'"'+String(typeof value==='string'&&/^[=+@\-\t\r]/.test(value)?"'"+value:value).replaceAll('"','""')+'"';await file('ghost-nova-shopping-list.csv',rows.map(row=>row.map(escape).join(',')).join('\r\n'));await file('ghost-nova-result.json',JSON.stringify(calculated,null,2));node.detail='Excel, CSV and calculation details saved.';break
      }
      case 'draft':{
       const result=calculated!.result,settings=calculated!.settings
       const requested=result.rows.filter(row=>row.buy>0),urgent=result.rows.filter(row=>row.urgent)
       run.draft=[
        '*NOVA — Weekly buying review*',
        `Planning date: ${settings.asOf} | Sales period: ${settings.start} to ${settings.end}`,
        '',
        '*Summary*',
        `${result.rows.length} products reviewed. ${requested.length} products need replenishment, totalling ${result.rows.reduce((sum,row)=>sum+row.buy,0)} units.`,
        `Estimated purchase cost: €${result.total.toFixed(2)}. Budget: €${settings.budget.toFixed(2)}.`,
        result.overBudget?`*Budget approval required:* the recommendation exceeds the budget by €${(result.total-settings.budget).toFixed(2)}.`:`The recommendation is within budget, with €${(settings.budget-result.total).toFixed(2)} remaining.`,
        `${urgent.length} products have an urgent stock warning.`,
        '',
        '*Product-by-product recommendation*',
        ...result.rows.flatMap((row,index)=>[
         `${index+1}. *${row.name}* (${row.id}) — ${row.buy>0?`Buy ${row.buy} units`:'No purchase recommended'}${row.urgent?' · URGENT':''}`,
         `   Supplier: ${row.supplier} | Lead time: ${row.leadDays} days`,
         `   Eligible sales: ${row.unitsSold} units over ${row.days} days (${row.dailyRate.toFixed(2)} units/day).`,
         `   Stock on hand: ${row.stock} | Incoming: ${row.incoming} | Incoming counted: ${row.eligibleIncoming}${row.incomingDate?` | ETA: ${row.incomingDate}`:''}.`,
         `   Target stock: ${row.targetStock} | Unit cost: €${row.unitCost.toFixed(2)} | Purchase cost: €${row.cost.toFixed(2)}.`,
         `   Calculation: ${row.explanation}`,
         ...(row.warning?[`   Warning: ${row.warning}`]:[]),
         '',
        ]),
        '*Planning assumptions*',
        `Review period: ${settings.reviewDays} days. Safety allowance: ${settings.safetyDays} days. Supplier lead times are included per product.`,
        'Only Paid and Shipped sales inside the reporting period count toward demand. Incoming deliveries count only when their date is eligible for the planning horizon.',
        'Costs reflect the exported unit prices; tax, shipping and supplier minimum-order constraints are not added.',
        '',
        '*Files available in Ghost*',
        ...run.files.map(item=>`• ${item.name}`),
        'Files are saved locally on the executing computer; they are not uploaded or attached to Slack.',
        '',
        '*Before approving*',
        '□ Confirm the reporting dates and inventory figures.',
        '□ Check incoming deliveries and supplier lead times.',
        '□ Review urgent products and any stock or data warnings.',
        result.overBudget?'□ Approve a higher budget or adjust quantities in Ghost.':'□ Confirm quantities and the available budget.',
        '□ Review the Excel buying list and approve the report in Ghost.',
        '',
        this.deliver?'*Report shared for review — purchasing approval pending.*':'*Delivery status: draft only — not sent.*',
        'No purchase orders have been placed. Approval records your buying decision in Ghost; no order is placed.',
        `Workflow: ${run.workflowName}`,
        `Run: ${run.id}`,
        `Browser source run: ${run.browserRunId}`,
       ].join('\n');await file('slack-draft.txt',run.draft);node.detail='Draft saved locally. No message sent.';
       if(this.deliver){
        const message=run.draft
        try{const receipt=await this.deliver(message,controller.signal,async()=>{run.delivery={state:'sending'};await this.save()});run.delivery={state:'sent',...receipt};node.detail='Posted to GHOST LLC #daily-reports through Screenpipe.'}
        catch(error){if(run.delivery?.state==='sending')run.delivery.state='unknown';node.output={sent:false,delivery:run.delivery,message:run.draft};await this.save();throw error}
       }
       break
      }
      case 'review':node.state='needs_review';node.detail='Review the quantities, budget and draft in Results. Report delivery is shown separately; approving does not place orders.';break
     }
    }}})
    controller.signal.throwIfAborted()
    switch(node.operation){
     case 'request':node.output={workflowId:workflow.id,userRequest:workflow.nodes[0].config.originalPrompt??workflow.name,discovery:novaDiscoveryDemo,process:workflow.nodes.slice(1).map(item=>({nodeId:item.id,name:item.label,operation:item.config.novaOperation})),browserTask:{nodeId:workflow.nodes[1].id,startUrl:workflow.nodes[1].config.startUrl,expectedFiles:['nova-restock-sales.csv','nova-restock-inventory.csv','nova-shopping-list.xlsx']}};break
     case 'browser':node.output={browserRunId:run.browserRunId,recordingId:run.recordingId,files:browserResult?.artifacts?.map(item=>({id:item.id,name:item.filename,state:item.state,bytes:item.bytes}))??[]};break
     case 'calculate':node.outputFileIds=run.files.filter(item=>item.name==='browser-exports.json').map(item=>item.id);node.output={parsedExportsFileIds:node.outputFileIds,settings:run.settings,recommendation:run.recommendation};break
     case 'report':node.outputFileIds=run.files.filter(item=>['ghost-nova-shopping-list.xlsx','ghost-nova-shopping-list.csv','ghost-nova-result.json'].includes(item.name)).map(item=>item.id);node.output={files:run.files.filter(item=>node.outputFileIds!.includes(item.id)),recommendation:run.recommendation};break
     case 'draft':node.outputFileIds=run.files.filter(item=>item.name==='slack-draft.txt').map(item=>item.id);node.output={message:run.draft,sent:run.delivery?.state==='sent',delivery:run.delivery,reportFiles:run.nodes[index-1].outputFileIds};break
     case 'review':node.output={approval:'pending',messageSent:run.delivery?.state==='sent'};break
    }
    if(node.state==='running')node.state='verified';await this.save()
   }
   run.state='needs_review'
  }catch(error){run.state=controller.signal.aborted?'cancelled':'failed';run.error=controller.signal.aborted?'Cancelled; inspect any browser actions already performed.':error instanceof Error?error.message:'Pipeline failed.';const node=run.nodes.find(n=>n.state==='running');if(node){node.state='failed';node.detail=run.error}}
  finally{run.finishedAt=new Date().toISOString();try{await this.save()}finally{this.active=null}}
  return structuredClone(run)
 }
 async approve(id:string){await this.ready;const run=this.runs.find(r=>r.id===uuid.parse(id));if(!run||run.state!=='needs_review')throw Error('Only completed reports awaiting review can be approved.');run.state='approved';run.approvedAt=new Date().toISOString();run.nodes.at(-1)!.state='verified';run.nodes.at(-1)!.output={approval:'approved',approvedAt:run.approvedAt,messageSent:run.delivery?.state==='sent'};await this.save()}

 async preview(runId:string,fileId:string){
  const path=await this.artifact(runId,fileId)
  if(!/\.(csv|json|txt)$/.test(path))throw Error('Preview supports CSV, JSON and text files. Open Excel files from the folder.')
  if((await stat(path)).size>100_000)throw Error('This file is too large to preview. Use Show file.')
  const text=await readFile(path,'utf8');const source=this.runs.find(r=>r.id===runId)?.sources?.find(f=>f.id===fileId);if(source&&createHash('sha256').update(text).digest('hex')!==source.sha256)throw Error('Source snapshot changed on disk. Its contents no longer match the calculation.');return text
 }
 async saveScenario(raw:unknown):Promise<BuyingScenario>{
  await this.ready
  const input=z.object({runId:uuid,budget:z.number().finite().min(0).max(1_000_000_000),quantities:z.record(z.string(),z.number().int().min(0).max(1_000_000)).optional()}).parse(raw)
  const run=this.runs.find(r=>r.id===input.runId)
  if(!run?.recommendation||!['needs_review','approved'].includes(run.state))throw Error('Choose a completed report before creating a proposal.')
  const plan=buyingPlan(run.recommendation,input.budget,input.quantities)
  const scenario:BuyingScenario={id:randomUUID(),createdAt:new Date().toISOString(),mode:input.quantities?'manual':'budget',plan,files:[],draft:`NOVA proposed buying list: ${plan.rows.reduce((n,r)=>n+r.quantity,0)} units, €${plan.total.toFixed(2)} estimated cost against €${plan.budget.toFixed(2)} budget. ${plan.unfundedUnits} recommended units remain unfunded. ${plan.total>plan.budget?'Over budget. ':''}Awaiting approval. Source run ${run.id}.`}
  const rows=buyingPlanRows(plan),book=new ExcelJS.Workbook()
  const sheet=book.addWorksheet('Proposed buying list');sheet.addRows(rows);sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];sheet.columns.forEach(column=>column.width=22)
  book.addWorksheet('Provenance').addRows([['Run ID',run.id],['Scenario ID',scenario.id],['Budget EUR',plan.budget],['Total EUR',plan.total],['Method',scenario.mode==='budget'?'Urgent products first, then lowest stock coverage; greedy allocation, not an optimum.':'User-edited quantities; may exceed budget.'],...(run.sources??[]).map(source=>[source.name,source.sha256])])
  const write=async(name:string,content:string|Uint8Array)=>{const id=randomUUID();await writeFile(join(this.root,run.id,id+'-'+name),content,{mode:0o600});scenario.files.push({id,name})}
  await write('buying-proposal.xlsx',new Uint8Array(await book.xlsx.writeBuffer()))
  await write('buying-proposal.json',JSON.stringify({runId:run.id,...scenario,sourceFiles:run.sources},null,2))
  await write('buying-proposal-message.txt',scenario.draft)
  ;(run.scenarios??=[]).push(scenario);await this.save();return structuredClone(scenario)
 }
 async approveScenario(raw:unknown){await this.ready;const {runId,scenarioId}=z.object({runId:uuid,scenarioId:uuid}).parse(raw);const scenario=this.runs.find(r=>r.id===runId)?.scenarios?.find(s=>s.id===scenarioId);if(!scenario)throw Error('Proposal not found for this run.');if(!scenario.approvedAt){scenario.approvedAt=new Date().toISOString();await this.save()}}
 async artifact(runId:string,fileId:string){await this.ready;const run=this.runs.find(r=>r.id===uuid.parse(runId));const file=[...(run?.files??[]),...(run?.scenarios??[]).flatMap(s=>s.files)].find(f=>f.id===uuid.parse(fileId));if(!file)throw Error('Unknown output file.');const filename=fileId+'-'+file.name;const directory=await realpath(join(this.root,runId)),path=await realpath(join(directory,filename));if(relative(directory,path)!==filename)throw Error('Invalid file path.');return path}
}
