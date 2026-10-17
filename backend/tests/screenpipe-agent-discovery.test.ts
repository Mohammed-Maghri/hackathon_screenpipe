import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverScreenpipeAgentWorkflow } from '../../src/main/screenpipeAgentDiscovery.js'
import { buildAgentGraph } from '../src/modules/discovery/discovery.agent.js'
const pipeId = 'ghost-workflow-discovery'
const answer = (requestId: string) => ({ requestId, workflow: { name: 'Report', description: 'Review dashboard' }, steps: [{ id: 'step_1', name: 'Review', description: 'Review metrics', application: 'Chrome', type: 'browser', startUrl: null, basis: 'observed', references: [] as string[], missingInformation: [] as string[] }], missingInformation: [] })
test('Pipe discovery: final-file-only integration, recovery and failures', async t => {
 const original = globalThis.fetch, root = await mkdtemp(join(tmpdir(), 'ghost-pipe-test-'))
 try {
  for (const mode of ['success','selected-range','offline','auth','unavailable','failed','wrong-run','empty','wrong-answer','invalid','missing','lost-start','save-retry','slow','timeout']) await t.test(mode, async () => {
   const input = { requestId: randomUUID(), prompt: '  Find my report\n', timeRange: 'Last 7 days' as const, ...(mode === 'selected-range' ? { selectedRange: { startTime: '2026-10-10T08:15:00.000Z', endTime: '2026-10-10T09:45:00.000Z' } } : {}) }
   const outputDir = join(root, input.requestId), stateDir = join(outputDir, 'state'); await mkdir(outputDir)
   const final = answer(input.requestId)
   if (mode === 'empty') final.steps = []
   if (mode === 'wrong-answer') final.requestId = randomUUID()
   if (mode !== 'missing') await writeFile(join(outputDir, input.requestId + '.json'), mode === 'invalid' ? 'not JSON' : JSON.stringify(final))
   let starts=0, saves=0, polls=0; const paths:string[]=[]; let saveFailed=false
   globalThis.fetch = async (url, init) => {
    const u = new URL(String(url)); paths.push(u.pathname+u.search)
    if (u.port === '3001') {
     assert.equal((init?.headers as Record<string,string>).Authorization, undefined)
     if (u.pathname.startsWith('/api/workflows/')) return new Response('{}',{status:404})
     if (u.pathname.endsWith('/prepare')) return Response.json({messages:[{role:'system',content:'Ghost instructions'},{role:'user',content:input.prompt}]})
     const body = JSON.parse(String(init?.body)); body.result=JSON.parse(body.responseText); delete body.responseText; assert.equal(body.result.requestId,input.requestId); saves++
     if (mode === 'save-retry' && !saveFailed) { saveFailed=true; return new Response('{}',{status:503}) }
     try { const graph=buildAgentGraph(body); return Response.json({id:input.requestId,...graph}) } catch { return new Response('{}',{status:422}) }
    }
    assert.equal((init?.headers as Record<string,string>).Authorization,'test-token'.replace(/^/,'Bearer '))
    if (mode==='offline') throw new Error('private response')
    if (mode==='auth') return new Response('{}',{status:401})
    if (mode==='unavailable') return new Response('{}',{status:409})
    if (u.pathname.endsWith('/run')) { starts++; const body=JSON.parse(String(init?.body)); assert.equal(body.run_context.prompt,input.prompt); assert.equal(body.run_context.systemPrompt,'Ghost instructions'); if (input.selectedRange) { assert.equal(body.run_context.startTime,input.selectedRange.startTime); assert.equal(body.run_context.endTime,input.selectedRange.endTime) } else assert.equal(Date.parse(body.run_context.endTime)-Date.parse(body.run_context.startTime),7*86400000); if(mode==='lost-start') throw new Error('lost'); return Response.json({success:true,execution_id:12}) }
    if (u.pathname.endsWith('/executions')) { assert.equal(u.searchParams.get('include_output'),'false'); return Response.json({data:[{id:mode==='wrong-run'?13:12,pipe_name:pipeId,status:mode==='failed'?'failed':mode==='timeout'||(mode==='slow'&&polls++===0)?'running':'completed'}]}) }
    return Response.json({config:{name:pipeId}})
   }
   const config={key:'test-token',url:'http://localhost:3030',backend:'http://localhost:3001',stateDir,outputDir,pollMs:1,timeoutMs:mode==='timeout'?50:1000}
   let result=await discoverScreenpipeAgentWorkflow(input,config)
   if (mode==='save-retry') result=await discoverScreenpipeAgentWorkflow(input,config)
   assert.equal(result.ok,['success','selected-range','save-retry','slow'].includes(mode))
   if (mode==='lost-start') { await discoverScreenpipeAgentWorkflow(input,config); assert.equal(starts,1) }
   if (result.ok) { assert.equal(starts,1); if (input.selectedRange) assert.deepEqual((result.workflow.nodes[0]!.config.discovery as Record<string,unknown>).selectedRange,input.selectedRange); assert.equal(result.workflow.nodes[0]!.config.basis,'unverified'); assert.deepEqual(result.workflow.nodes[0]!.config.evidenceIds,[]) }
   if (['offline','auth','unavailable','failed','empty','wrong-run','wrong-answer','invalid','missing','lost-start'].includes(mode)) assert.equal(saves,0)
   assert.ok(paths.every(p=> !/search|frames|activity-summary|session|logs|chat\/completions/.test(p)))
  })
 } finally { globalThis.fetch=original; await rm(root,{recursive:true,force:true}) }
})
test('uncertain claims and credentials do not become verified evidence', () => {
 const requestId=randomUUID(), payload={requestId,prompt:'Find report',timeRange:'Last 7 days',pipeId,executionId:12,result:answer(requestId)}
 const graph=buildAgentGraph(payload); assert.equal(graph.nodes[0]!.config.referencesVerified,false)
 payload.result.steps[0]!.basis='inferred'; assert.throws(()=>buildAgentGraph(payload))
 payload.result.steps[0]!.missingInformation=['Confirm this step']; assert.doesNotThrow(()=>buildAgentGraph(payload))
 payload.result.steps[0]!.description='password: hidden'; assert.throws(()=>buildAgentGraph(payload))
})
