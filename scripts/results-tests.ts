import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {ResultsStore} from '../src/main/resultsStore'
const root=await mkdtemp(join(tmpdir(),'ghost-results-')),store=new ResultsStore(root),workflowId=randomUUID(),nodeId=randomUUID()
assert.equal((await store.list()).runs.length,0)
async function fixture(stock:number,day:number,state='completed',node=nodeId){
 const recordingId=randomUUID(),runId=randomUUID(),fileId=randomUUID()+'.csv',directory=join(root,recordingId)
 await mkdir(join(directory,'runs'),{recursive:true});await mkdir(join(directory,'downloads'))
 await writeFile(join(directory,'session.json'),JSON.stringify({id:recordingId,workflowId,nodeId:node}))
 const path=join(directory,'downloads',fileId)
 await writeFile(path,`Product ID,Product,Stock\nhoodie,Black hoodie,${stock}\n`)
 await writeFile(join(directory,'runs',runId+'.json'),JSON.stringify({runId,recordingId,workflowId,state,total:1,startedAt:`2026-10-${day}T09:00:00Z`,finishedAt:`2026-10-${day}T09:00:10Z`,results:[{sequence:1,type:'click',state:'verified',evidence:'SECRET_SHOULD_NOT_LEAK'}],artifacts:[{id:fileId,filename:'nova-restock-inventory.csv',path,bytes:50,state:'completed'}]}))
 return{recordingId,runId,fileId,path}
}
const first=await fixture(12,10)
assert.equal((await store.compare(first.recordingId,first.runId)).rows[0].delta,null)
await fixture(100,11,'failed');await fixture(999,12,'completed',randomUUID())
const latest=await fixture(3,13)
const compared=await store.compare(latest.recordingId,latest.runId)
assert.equal(compared.baseline?.id,first.runId);assert.equal(compared.rows[0].delta,-9)
assert.ok(!JSON.stringify(await store.list()).includes('SECRET_SHOULD_NOT_LEAK'))
assert.equal(await store.artifact(latest.recordingId,latest.runId,latest.fileId),latest.path)
await assert.rejects(()=>store.artifact('../escape',latest.runId,latest.fileId))
await assert.rejects(()=>store.artifact(latest.recordingId,latest.runId,first.fileId))
await writeFile(latest.path,'Product ID,Product,Stock\nx,X,3\nx,X,4\n')
assert.equal((await store.compare(latest.recordingId,latest.runId)).rows.length,0)
const outside=await mkdtemp(join(tmpdir(),'ghost-outside-'));await writeFile(join(outside,'file'),'outside')
const malicious=await fixture(5,14);const {unlink}=await import('node:fs/promises');await unlink(malicious.path);await symlink(join(outside,'file'),malicious.path)
await assert.rejects(()=>store.artifact(malicious.recordingId,malicious.runId,malicious.fileId))
console.log('PASS: real-file run history, baseline, changed stock, failed/other-node exclusion, redaction, malformed CSV and file confinement')
