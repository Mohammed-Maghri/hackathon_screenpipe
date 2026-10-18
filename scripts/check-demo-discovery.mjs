import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import http from 'node:http'
import electronPath from 'electron'
import {_electron} from 'playwright-core'
import {createWorkflowSchema} from '../backend/dist/modules/workflows/workflow.schemas.js'
const bundle=await build({entryPoints:['src/renderer/src/data/demoDiscovery.ts'],bundle:true,write:false,format:'esm'})
const {matchDemo,demoWorkflow}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
assert.equal(matchDemo('Check invetory and stok for next week'),'nova')
assert.equal(matchDemo('Review overdue paymnts'),'forma')
assert.equal(matchDemo('sales and invoices'),null)
assert.equal(matchDemo('help me'),null)
for(const scenario of ['nova','forma']){const d=createWorkflowSchema.parse(demoWorkflow(scenario,'  My original prompt  '));assert.equal(d.nodes.length,5);assert.equal(d.edges.length,4);assert.equal(d.nodes[0].config.application,'Screenpipe');assert.ok(d.nodes.every(n=>n.config.source==='demo'&&n.config.originalPrompt==='  My original prompt  '))}
let records=[];let external=0
const server=http.createServer((_req,res)=>{ external++;res.writeHead(503);res.end('{}') })
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
const profile=await mkdtemp(join(tmpdir(),'ghost-demo-check-'))
const app=await _electron.launch({executablePath:electronPath,args:['.',`--user-data-dir=${profile}`],env:{...process.env,GHOST_BACKEND_URL:url,SCREENPIPE_LOCAL_API_URL:url,SCREENPIPE_LOCAL_API_KEY:'test-only'}})
try{
 const page=await app.firstWindow();await page.waitForSelector('.appearance-selector')
 await page.evaluate(()=>{location.hash='/dashboard'})
 assert.equal(await page.getByText('Pitch demo', {exact:false}).count(),0)
 await page.getByRole('button',{name:'NOVA · Restock products',exact:true}).click()
 assert.match(await page.locator('.home-dashboard textarea').inputValue(), /NOVA/)
 await page.getByRole('button',{name:'Forma · Review payments',exact:true}).click()
 assert.match(await page.locator('.home-dashboard textarea').inputValue(), /Forma/)
 for(const prompt of ['Check invetory and stok next week','Review overdue paymnts']){
  await page.locator('.home-dashboard textarea').fill(prompt)
  await page.locator('.discovery-composer button[type=submit]').click()
  await page.getByTestId('workflow-generation').waitFor({state:'visible'})
  const firstNode = page.locator('.canvas-node').first()
  await firstNode.evaluate(el => { window.__generationNode = el })
  assert.equal(await page.getByTestId('workflow-generation').getAttribute('data-stage'),'thinking')
  assert.equal(await firstNode.getAttribute('data-generation-phase'),'-1')
  await page.waitForFunction(()=>document.querySelector('.canvas-node')?.getAttribute('data-generation-phase')==='0')
  assert.equal(await firstNode.locator('.app-mark').evaluate(el=>getComputedStyle(el).opacity),'0')
  assert.match(await page.getByTestId('workflow-generation').innerText(),/Thinking · building your workflow/)
  await page.waitForFunction(()=>document.querySelector('.canvas-node')?.getAttribute('data-generation-phase')==='1')
  assert.equal(await page.locator('.board-generation-edge').count(),0)
  await page.waitForFunction(()=>document.querySelector('.canvas-node')?.getAttribute('data-generation-phase')==='2')
  assert.equal(await page.locator('.board-generation-edge').count(),0)
  await page.waitForFunction(()=>document.querySelectorAll('.canvas-node')[1]?.getAttribute('data-generation-phase')==='0')
  assert.equal(await page.locator('.board-generation-edge').count(),0,'Destination box must appear before its line')
  await page.waitForSelector('.board-generation-edge')
  assert.match(await page.getByTestId('workflow-generation').innerText(),/Thinking · building your workflow/)
  assert.equal(await page.locator('.canvas-node').nth(1).getAttribute('data-generation-phase'),'0','Line draws into the visible empty destination box')
  assert.equal(await page.locator('.board-generation-edge .react-flow__edge-path').first().evaluate(el=>getComputedStyle(el).animationName),'board-connect')
  await page.screenshot({path:'/tmp/ghost-workflow-generation.png'})
  await page.getByTestId('workflow-generation').waitFor({state:'hidden'})
  await page.waitForSelector('.react-flow__node')
  assert.equal(await page.locator('.react-flow__node').count(),5)
  assert.equal(await page.locator('.canvas-node .app-mark img').count(),5)
  assert.equal(await firstNode.evaluate(el=>el===window.__generationNode),true,'The real board node must remain mounted')
  records=await page.evaluate(()=>JSON.parse(localStorage.getItem('ghost.prepared-workflows.v1')??'[]'))
  assert.equal(records[0].nodes[0].config.originalPrompt,prompt)
  await page.evaluate(()=>location.hash='/dashboard')
 }
 await page.locator('.home-dashboard textarea').fill('sales and invoices')
 await page.locator('.discovery-composer button[type=submit]').click()
 await page.getByRole('button',{name:'NOVA restocking',exact:true}).waitFor()
 assert.equal(records.length,2)
 await page.getByRole('button',{name:'NOVA restocking',exact:true}).click()
 await page.getByTestId('workflow-generation').waitFor({state:'visible'})
 await page.getByRole('button',{name:'Show all steps'}).click()
 await page.getByTestId('workflow-generation').waitFor({state:'hidden'})
  await page.waitForSelector('.react-flow__node')
 records=await page.evaluate(()=>JSON.parse(localStorage.getItem('ghost.prepared-workflows.v1')??'[]'))
 assert.equal(records.length,3);assert.equal(external,0,'Demo must not call Screenpipe, AI or discovery endpoints')
 assert.ok(records.every(r=>r.nodes.every(n=>n.config.evidenceIds.length===0)))
 await page.reload();await page.getByTestId('workflow-generation').waitFor({state:'hidden'})
  await page.waitForSelector('.react-flow__node');assert.equal(await page.locator('.react-flow__node').count(),5)
 assert.equal(await page.locator('.canvas-node .app-mark img').count(),5)
 console.log('PASS: typo routing, ambiguous choice, original prompt, five-node graphs, local persistence and reload, saved boards; zero backend/Screenpipe/AI calls with server returning 503.')
}finally{await app.close();server.closeAllConnections();server.close()}
