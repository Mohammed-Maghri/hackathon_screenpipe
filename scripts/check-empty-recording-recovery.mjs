import assert from 'node:assert/strict'
import electronPath from 'electron'
import {_electron} from 'playwright-core'
const profile=process.env.GHOST_RECOVERY_PROFILE
if(!profile)throw Error('Set GHOST_RECOVERY_PROFILE to an isolated, previously taught profile')
const app=await _electron.launch({executablePath:electronPath,args:['.',`--user-data-dir=${profile}`]})
try {
 const page=await app.firstWindow()
 await page.waitForFunction(()=>!!window.ghost?.browser)
 const result=await page.evaluate(async()=>{
  const rows=JSON.parse(localStorage.getItem('ghost.prepared-workflows.v1')||'[]')
  const workflow=rows.find(w=>w.nodes.some(n=>n.config.demoScenario==='nova'))
  const node=workflow.nodes.find(n=>n.config.stepType==='browser')
  window.__recoveryState=null
  window.ghost.browser.onState(s=>window.__recoveryState=s)
  location.hash='/workflows/'+workflow.id+'/record/'+node.id
  return {url:node.config.startUrl}
 })
 await page.waitForFunction(()=>!!window.__recoveryState?.sessionId)
 const token=await page.evaluate(()=>window.__recoveryState.sessionId)
 await page.waitForFunction(async token=>(await window.ghost.browser.diagnostics(token)).captureReady,token)
 const old=await page.evaluate(token=>window.ghost.browser.recordingStatus(token),token)
 assert.equal(old.state,'stopped')
 await page.evaluate(async({token,url})=>{
  const {bounds}=await window.ghost.browser.diagnostics(token)
  await window.ghost.browser.open(token,url,{...bounds,visible:true},true)
 },{token,url:result.url})
 await page.waitForFunction(async token=>(await window.ghost.browser.diagnostics(token)).captureReady,token)
 await page.evaluate(token=>window.ghost.browser.recordingControl(token,'stop'),token)
 const preview=await page.evaluate(token=>window.ghost.browser.replayPreview(token),token)
 assert.equal(preview.interactions,0)
 assert.equal(preview.savedRecordingAvailable,true)
 await page.evaluate(async({token,url})=>{
  const {bounds}=await window.ghost.browser.diagnostics(token)
  await window.ghost.browser.open(token,url,{...bounds,visible:true},false)
 },{token,url:result.url})
 const restored=await page.evaluate(token=>window.ghost.browser.recordingStatus(token),token)
 assert.equal(restored.id,old.id)
 const recovered=await page.evaluate(token=>window.ghost.browser.replayPreview(token),token)
 assert.ok(recovered.interactions>0)
 assert.deepEqual(recovered.blockers,[])
 console.log('PASS: empty current session reports zero interactions, offers saved recording, restores original recording ID and replayable plan without overwriting it.')
}finally{await app.close()}
