import { mkdir, appendFile, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { RecordedEvent, RecordingStatus } from '../shared/recording'

export class RecordingStore {
  readonly id = randomUUID()
  readonly startedAt = Date.now()
  readonly directory: string
  readonly eventsPath: string
  state: RecordingStatus['state'] = 'recording'
  count = 0
  error: string | null = null
  private queue: Promise<void>
  constructor(root: string, readonly workflowId: string, readonly nodeId: string) {
    this.directory = join(root, this.id)
    this.eventsPath = join(this.directory, 'events.jsonl')
    this.queue = mkdir(this.directory, { recursive: true, mode: 0o700 }).then(() => writeFile(join(this.directory, 'session.json'), JSON.stringify({ schemaVersion: 3, id: this.id, workflowId, nodeId, startedAt: new Date(this.startedAt).toISOString(), environment: { electron: process.versions.electron, chromium: process.versions.chrome, platform: process.platform }, coordinates: 'CSS pixels; client relative to website viewport; page includes scroll; normalized element offsets included', limitations: ['Main frame and uniquely identified nested frames; transformed frame geometry is unsupported', 'No screenshots, clipboard contents, cookies, or network bodies', 'Sensitive fields are redacted; record after signing in', 'Input values limited to 10000 characters; scrolling is coalesced'] }, null, 2), { mode: 0o600 })).catch(error => { this.error = String(error) })
  }
  append(type: string, url: string, data: Record<string, unknown>): RecordedEvent | null {
    if (this.state !== 'recording' || this.error) return null
    const event: RecordedEvent = { sequence: ++this.count, timestamp: new Date().toISOString(), elapsedMs: Date.now() - this.startedAt, type, url, data }
    const line = JSON.stringify(event) + '\n'
    this.queue = this.queue.then(() => appendFile(this.eventsPath, line, { mode: 0o600 })).catch(error => { this.error = String(error) })
    return event
  }
  status(): RecordingStatus { return { id: this.id, state: this.state, eventCount: this.count, path: this.directory, error: this.error } }
  async flush() { await this.queue; if (this.error) throw new Error(this.error) }
  async stop() {
    this.state = 'stopped'
    await this.flush()
    await writeFile(join(this.directory, 'finished.json'), JSON.stringify({ endedAt: new Date().toISOString(), eventCount: this.count }), { mode: 0o600 })
    return this.status()
  }
  async exportJSON() {
    await this.flush()
    const metadata = JSON.parse(await readFile(join(this.directory, 'session.json'), 'utf8'))
    let text = ''
    try { text = await readFile(this.eventsPath, 'utf8') } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    let inputs = []
    try { inputs = JSON.parse(await readFile(join(this.directory, 'inputs.json'), 'utf8')) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    return JSON.stringify({ ...metadata, exportVersion: 3, inputs, state: this.state, eventCount: this.count, events: text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) }, null, 2)
  }
}
