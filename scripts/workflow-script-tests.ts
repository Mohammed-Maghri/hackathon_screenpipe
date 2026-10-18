import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { WorkflowScriptStore } from '../src/main/workflowScripts'
import { handlers, LocalArtifacts } from '../src/main/dataProcessing/executor'
const root=await mkdtemp(join(tmpdir(),'ghost-script-test-'))
try {
 const store=new WorkflowScriptStore(root)
 const graph={id:randomUUID(),name:'Report',nodes:[
  {id:'browser',label:'Download',config:{stepType:'browser',startUrl:'https://example.com/reports',password:'DO_NOT_EXPORT',instructions:['DO_NOT_EXPORT']}},
  {id:'filter',label:'Filter',config:{stepType:'data_processing',dataProcessing:{version:1,operation:'filter_rows',inputs:{rows:{nodeId:'browser',output:'table',type:'rows'}},rules:{predicates:[{column:'status',operator:'eq',value:'Paid'}],mode:'all'}}}},
  {id:'slack',label:'Send report',config:{stepType:'integration',token:'DO_NOT_EXPORT'}},
 ],edges:[{sourceNodeId:'browser',targetNodeId:'filter'},{sourceNodeId:'filter',targetNodeId:'slack'}]}
 const pack=await store.generate(graph)
 assert.equal(pack.nodes.length,3)
 assert.equal(pack.nodes[1].status,'runtime_required')
 assert.equal(pack.nodes[2].status,'blocked')
 for(const file of pack.files) assert.ok(!(await store.read(graph.id,pack.revision,file)).includes('DO_NOT_EXPORT'))
 const module=await import(pathToFileURL(join(pack.directory,'node-002.mjs')).href)
 const output=await module.run({processing:{execute:async(descriptor:any,inputs:any)=>handlers.filter_rows(inputs,descriptor.config,new LocalArtifacts(root))}}, {rows:{type:'rows',value:[{status:'Paid',amount:10},{status:'Pending',amount:20}]}})
 assert.deepEqual(output.rows.value,[{status:'Paid',amount:10}])
 await assert.rejects(()=>module.run({},{}),/runtime is required/)
 const slack=await import(pathToFileURL(join(pack.directory,'node-003.mjs')).href)
 await assert.rejects(()=>slack.run({},{}),/Delivery is not configured/)
 const second=await store.generate({...graph,name:'Updated'})
 assert.notEqual(pack.revision,second.revision)
 assert.ok(await readFile(join(pack.directory,'manifest.json'),'utf8'))
 await assert.rejects(()=>store.read(graph.id,pack.revision,'../../secret'),/Invalid script/)
 await assert.rejects(()=>store.path('../escape',pack.revision))
 await assert.rejects(()=>store.generate({...graph,edges:[...graph.edges,{sourceNodeId:'slack',targetNodeId:'browser'}]}),/cycle/)
 await assert.rejects(()=>store.generate({...graph,nodes:[{...graph.nodes[0],config:{stepType:'browser',startUrl:'https://user:secret@example.com'}}],edges:[]}),/credentials/)
 console.log('PASS: per-node modules, real filter handler execution, explicit blocked delivery, no exported credentials, revisions preserved, traversal/cycle rejection.')
} finally {await rm(root,{recursive:true,force:true})}
