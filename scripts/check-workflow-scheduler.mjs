import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
const directory = await mkdtemp(join(tmpdir(), 'ghost-scheduler-'))
try {
  const module = join(directory, 'scheduler.mjs')
  await build({entryPoints:['src/main/workflowScheduler.ts'],outfile:module,bundle:true,platform:'node',format:'esm'})
  const { WorkflowScheduler } = await import(module)
  const id = '80000000-0000-4000-8000-000000000001'
  let runs = 0
  const scheduler = new WorkflowScheduler(directory, async () => { runs++ })
  await scheduler.load()
  await assert.rejects(scheduler.save({workflowId:id,nextRun:new Date(0).toISOString(),intervalMinutes:60}), /future/)
  await assert.rejects(scheduler.save({workflowId:id,nextRun:new Date(Date.now()+100000).toISOString(),intervalMinutes:1}))
  const due = Date.now()+60000
  await scheduler.save({workflowId:id,nextRun:new Date(due).toISOString(),intervalMinutes:60})
  const restored = new WorkflowScheduler(directory, async () => { runs++ })
  await restored.load(); assert.equal(restored.list()[0].nextRun,new Date(due).toISOString())
  await restored.tick(due-1); assert.equal(runs,0)
  await restored.tick(due+7200000); assert.equal(runs,1)
  assert.equal(restored.list()[0].result,'Completed')
  await restored.tick(due+7200000); assert.equal(runs,1)
  await restored.remove(id); await restored.tick(due+99999999); assert.equal(runs,1)
  await restored.save({workflowId:id,nextRun:new Date(due).toISOString(),intervalMinutes:0})
  await restored.tick(due); await restored.tick(due+1); assert.equal(runs,2); assert.equal(restored.list()[0].nextRun,null)
  let release
  const blocked = new WorkflowScheduler(directory, () => new Promise(resolve => { release=resolve }))
  await blocked.load(); const running = blocked.run(id)
  await assert.rejects(blocked.run(id),/already running/)
  await assert.rejects(blocked.remove(id),/current run/)
  while (!release) await new Promise(resolve=>setTimeout(resolve,5))
  release(); await running
  const failed = new WorkflowScheduler(directory, async () => {throw new Error('Missing verified input')})
  await failed.load(); await assert.rejects(failed.run(id),/Missing verified input/)
  assert.equal(failed.list()[0].result,'Missing verified input')
  console.log('PASS persisted schedules, validation, due times, missed intervals, one-shot runs, removal, concurrency and failure status')
} finally { await rm(directory,{recursive:true,force:true}) }
