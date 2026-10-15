import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type { WorkflowSchedule } from '../shared/workflowSchedule'
const schema = z.object({ workflowId: z.string().uuid(), nextRun: z.string().datetime().nullable(), intervalMinutes: z.union([z.literal(0), z.literal(60), z.literal(1440), z.literal(10080)]), lastRun: z.string().optional(), result: z.string().optional() }).strict()
export class WorkflowScheduler {
  private entries: WorkflowSchedule[] = []
  private busy = new Set<string>()
  private writes: Promise<void> = Promise.resolve()
  constructor(private directory: string, private execute: (id: string) => Promise<void>) {}
  async load() {
    try { this.entries = z.array(schema).parse(JSON.parse(await readFile(join(this.directory, 'workflow-schedules.json'), 'utf8'))) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  list() { return this.entries.map(entry => ({ ...entry, result: this.busy.has(entry.workflowId) ? 'Running…' : entry.result })) }
  private persist() {
    const data = JSON.stringify(this.entries)
    const write = this.writes.then(async () => {
      await mkdir(this.directory, { recursive: true })
      const file = join(this.directory, 'workflow-schedules.json')
      await writeFile(file + '.tmp', data, { mode: 0o600 }); await rename(file + '.tmp', file)
    })
    this.writes = write.catch(() => {})
    return write
  }
  async save(input: unknown) {
    const entry = schema.parse(input)
    if (!entry.nextRun || Date.parse(entry.nextRun) <= Date.now()) throw new Error('Choose a future start time.')
    if (this.busy.has(entry.workflowId)) throw new Error('Wait for the current run to finish.')
    this.entries = [...this.entries.filter(e => e.workflowId !== entry.workflowId), entry]
    await this.persist()
  }
  async remove(id: string) {
    z.string().uuid().parse(id)
    if (this.busy.has(id)) throw new Error('Wait for the current run to finish.')
    this.entries = this.entries.filter(e => e.workflowId !== id); await this.persist()
  }
  async run(id: string) {
    z.string().uuid().parse(id)
    if (this.busy.has(id)) throw new Error('This workflow is already running.')
    this.busy.add(id)
    let entry = this.entries.find(e => e.workflowId === id)
    if (!entry) { entry = { workflowId: id, nextRun: null, intervalMinutes: 0 }; this.entries.push(entry) }
    entry.lastRun = new Date().toISOString(); entry.result = 'Running…'
    try { await this.persist(); await this.execute(id); entry.result = 'Completed' }
    catch (error) { entry.result = error instanceof Error ? error.message : 'Run failed'; throw error }
    finally { this.busy.delete(id); await this.persist() }
  }
  async tick(now = Date.now()) {
    for (const entry of this.entries) {
      if (!entry.nextRun || Date.parse(entry.nextRun) > now || this.busy.has(entry.workflowId)) continue
      // Skip missed intervals; run once on wake instead of replaying a backlog.
      entry.nextRun = entry.intervalMinutes ? new Date(now + entry.intervalMinutes * 60000).toISOString() : null
      await this.persist()
      await this.run(entry.workflowId).catch(() => {})
    }
  }
}
