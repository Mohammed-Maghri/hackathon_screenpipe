import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { installPrelearnedBrowser, prelearnedSource, preparedLogin } from '../src/main/prelearnedBrowser'
import { RecordingStore } from '../src/main/recordingStore'
const root=await mkdtemp(join(tmpdir(),'ghost-prelearned-unit-'))
const workflow=randomUUID(), node=randomUUID()
await Promise.all(Array.from({length:3},()=>installPrelearnedBrowser(root,workflow,node,'https://hackathon-screenpipe.vercel.app/nova/restocking')))
const saved=(await RecordingStore.restore(root,workflow,node))!
assert.ok(saved);assert.equal((await prelearnedSource(saved))?.scenario,'nova')
assert.ok(!JSON.parse(await saved.exportJSON()).events.some((event:{type:string})=>event.type==='input'))
await installPrelearnedBrowser(root,workflow,node,'https://hackathon-screenpipe.vercel.app/finance')
assert.equal((await RecordingStore.restore(root,workflow,node))?.id,saved.id,'Do not overwrite existing teaching')
assert.equal((await prelearnedSource(saved))?.scenario,'nova')
const unknown=randomUUID()
await installPrelearnedBrowser(root,workflow,unknown,'https://example.com/finance')
assert.equal(await RecordingStore.restore(root,workflow,unknown),null)
const contents=await readFile(saved.eventsPath,'utf8')
await writeFile(saved.eventsPath,contents.replaceAll('restock-sales-export','changed-sales-export'))
assert.equal(await prelearnedSource(saved),null,'Changed plans cannot inherit verified teaching status')
await assert.rejects(()=>readFile(join(saved.directory,'last-replay.json')),'Import must not fabricate a local run')
console.log('PASS: verified template import, concurrent idempotence, preservation, URL isolation, tamper detection, no fabricated run')

const loginBefore=await preparedLogin(root,workflow,node,'https://hackathon-screenpipe.vercel.app/nova')
assert.equal(loginBefore?.username,'alex@nova.test')
assert.equal(await preparedLogin(root,workflow,node,'https://example.com/nova'),null)
assert.equal(await preparedLogin(root,workflow,node,'https://hackathon-screenpipe.vercel.app/finance'),null)
const replacement=new RecordingStore(root,workflow,node)
replacement.append('navigation','https://hackathon-screenpipe.vercel.app/nova/restocking',{})
replacement.append('click','https://hackathon-screenpipe.vercel.app/nova/restocking',{target:{tag:'button',testId:'restock-sales-export'}})
await replacement.stop(true,false)
await installPrelearnedBrowser(root,workflow,node,'https://hackathon-screenpipe.vercel.app/nova/restocking')
assert.equal((await RecordingStore.restore(root,workflow,node))?.id,replacement.id)
assert.deepEqual(await preparedLogin(root,workflow,node,'https://hackathon-screenpipe.vercel.app/nova'),loginBefore)
assert.equal(await preparedLogin(root,randomUUID(),node,'https://hackathon-screenpipe.vercel.app/nova'),null)
const {readdir}=await import('node:fs/promises')
for(const file of await readdir(join(root,'.prepared-logins'))) {
 const raw=await readFile(join(root,'.prepared-logins',file),'utf8');assert.ok(!raw.includes('nova-demo'));assert.ok(!raw.includes('alex@nova.test'))
}
console.log('PASS: replacement recording retains encrypted node login, workflow isolation and origin restriction')
