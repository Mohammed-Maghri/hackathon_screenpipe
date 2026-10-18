import assert from 'node:assert/strict'
import { build } from 'esbuild'
const values = new Map()
let blocked = false
Object.defineProperty(globalThis, 'localStorage', { value: {
 getItem: key => values.get(key) ?? null,
 setItem: (key,value) => { if(blocked) throw Error('Quota'); values.set(key,value) },
}})
globalThis.window = { ghost: new Proxy({}, { get() { throw Error('Unexpected backend bridge call') } }) }
const bundle = await build({entryPoints:['src/renderer/src/data/workflowClient.ts'],bundle:true,write:false,format:'esm',define:{'import.meta.env.VITE_GHOST_DISCOVERY_MODE':'"prepared"'}})
const {workflowClient: client} = await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const created = await client.createWorkflow({name:'NOVA',description:'Local',nodes:[],edges:[]})
assert.equal(created.ok,true)
const id=created.workflow.id
assert.equal((await client.updateWorkflow(id,{name:'Changed',nodes:[],edges:[]})).ok,true)
assert.equal((await client.getWorkflow(id)).workflow.name,'Changed')
assert.equal((await client.listWorkflows(0,{search:'changed'})).total,1)
blocked=true
assert.equal((await client.updateWorkflow(id,{name:'Lost',nodes:[],edges:[]})).ok,false)
blocked=false
assert.equal((await client.getWorkflow(id)).workflow.name,'Changed')
assert.equal((await client.deleteWorkflow(id)).ok,true)
assert.equal((await client.listWorkflows()).total,0)
const migration = await client.createWorkflow({name:'Old NOVA',description:'',nodes:[{id:'browser',label:'Browser',type:'ACTION',positionX:0,positionY:0,config:{source:'demo',demoScenario:'nova',startUrl:'http://127.0.0.1:3104/nova/restocking'}},{id:'custom',label:'Custom',type:'ACTION',positionX:0,positionY:1,config:{source:'demo',demoScenario:'nova',startUrl:'https://custom.example/'}}],edges:[]})
const migrated = await client.getWorkflow(migration.workflow.id)
assert.equal(migrated.workflow.nodes[0].config.startUrl,'https://hackathon-screenpipe.vercel.app/nova/restocking')
assert.equal(migrated.workflow.nodes[1].config.startUrl,'https://custom.example/')
values.set('ghost.prepared-workflows.v1','broken')
assert.equal((await client.createWorkflow({name:'No overwrite',description:''})).ok,false)
assert.equal(values.get('ghost.prepared-workflows.v1'),'broken')
console.log('PASS: local create/list/filter/get/update/delete, storage failure, corrupt data preservation; no backend bridge calls.')
values.set('ghost.prepared-workflows.v1','[]')
let release
let prepared
window.ghost={browser:{prepareHosted:async(id,nodes)=>{prepared={id,nodes};await new Promise(resolve=>{release=resolve})}}}
const input={name:'NOVA prepared',nodes:[{id:crypto.randomUUID(),label:'Browser',type:'ACTION',positionX:0,positionY:0,config:{stepType:'browser',startUrl:'https://hackathon-screenpipe.vercel.app/nova/restocking'}}],edges:[]}
const pending=client.createWorkflow(input)
await new Promise(resolve=>setTimeout(resolve,0))
assert.equal((await client.listWorkflows()).total,0,'Do not publish workflow before browser assets are saved')
release();const ready=await pending
assert.equal(ready.ok,true);assert.equal(prepared.id,ready.workflow.id);assert.equal(prepared.nodes[0].id,input.nodes[0].id)
window.ghost.browser.prepareHosted=async()=>{throw Error('Disk failure')}
const failure=await client.createWorkflow(input)
assert.equal(failure.ok,false);assert.match(failure.error,/browser task and login/)
assert.equal((await client.listWorkflows()).total,1)
console.log('PASS: generation awaits browser/login persistence; preparation failure never publishes an incomplete workflow')
