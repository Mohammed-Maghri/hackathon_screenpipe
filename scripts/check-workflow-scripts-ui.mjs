import assert from 'node:assert/strict'
import {mkdtemp,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import electronPath from 'electron'
import {_electron} from 'playwright-core'
const profile=await mkdtemp(join(tmpdir(),'ghost-script-ui-'))
const app=await _electron.launch({executablePath:electronPath,args:['.',`--user-data-dir=${profile}`]})
try {
 const page=await app.firstWindow();await page.waitForFunction(()=>!!window.ghost?.scripts)
 const id=await page.evaluate(()=>{
  const id=crypto.randomUUID(),nodeId=crypto.randomUUID()
  const workflow={id,name:'Script export check',description:'',status:'DRAFT',updatedAt:new Date().toISOString(),nodes:[{id:nodeId,label:'Hosted download',type:'ACTION',positionX:0,positionY:0,config:{stepType:'browser',application:'Chrome',startUrl:'https://example.com',status:'needs_recording'}}],edges:[]}
  localStorage.setItem('ghost.prepared-workflows.v1',JSON.stringify([workflow]));location.hash='/workflows/'+id;return id
 })
 await page.getByRole('button',{name:'Local scripts',exact:true}).click()
 await page.getByRole('button',{name:'Generate scripts',exact:true}).click()
 await page.getByRole('button',{name:'Generate new revision',exact:true}).waitFor()
 await page.getByRole('button',{name:'Hosted download · node-001.mjs',exact:true}).click()
 await page.waitForFunction(()=>document.querySelector('pre')?.textContent?.includes('runtime.browser.replay'))
 const pack=await page.evaluate(id=>window.ghost.scripts.latest(id),id)
 assert.ok(pack.directory.startsWith(profile))
 assert.match(await readFile(join(pack.directory,'node-001.mjs'),'utf8'),/export async function run/)
 await page.reload();await page.getByRole('button',{name:'Local scripts',exact:true}).click()
 await page.getByRole('button',{name:'Generate new revision',exact:true}).waitFor()
 const restored=await page.evaluate(id=>window.ghost.scripts.latest(id),id)
 assert.equal(restored.revision,pack.revision)
 await assert.rejects(()=>page.evaluate(id=>window.ghost.scripts.read(id,'../../escape','manifest.json'),id))
 console.log('PASS: real editor generates local module via IPC, previews script, reload restores package, traversal rejected.')
}finally{await app.close()}
