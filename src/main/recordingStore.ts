import { recordingSecretsBackend } from './recordingSecretsBackend'
import { RecordingSecrets } from './recordingSecrets'
import { mkdir, appendFile, writeFile, readFile, rename, realpath, stat } from 'node:fs/promises'
import { join, basename, extname, sep } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import type { RecordedEvent, RecordingStatus, ReplayStatus } from '../shared/recording'

export class RecordingStore {
  readonly id: string
  readonly startedAt: number
  readonly directory: string
  readonly eventsPath: string
  state: RecordingStatus['state'] = 'recording'
  count = 0
  error: string | null = null
  private inputsDirty = false
  private secretSync: 'none' | 'pending' | 'saved' | 'failed' = 'none'
  private secretSyncQueue: Promise<void> = Promise.resolve()
  private queue: Promise<void>
  private stopQueue: Promise<void> = Promise.resolve()
  private replayQueue: Promise<void> = Promise.resolve()
  private secrets: RecordingSecrets
  constructor(private root: string, readonly workflowId: string, readonly nodeId: string, restored?: { id: string; startedAt: string; count: number }) {
    this.id = restored?.id ?? randomUUID()
    this.startedAt = restored ? Date.parse(restored.startedAt) : Date.now()
    this.secrets = new RecordingSecrets(join(root, '.secrets'))
    this.directory = join(root, this.id)
    this.eventsPath = join(this.directory, 'events.jsonl')
    if (restored) { this.count = restored.count; this.state = 'stopped'; this.queue = Promise.resolve(); return }
    this.queue = mkdir(this.directory, { recursive: true, mode: 0o700 }).then(() => writeFile(join(this.directory, 'session.json'), JSON.stringify({ schemaVersion: 3, id: this.id, workflowId, nodeId, startedAt: new Date(this.startedAt).toISOString(), environment: { electron: process.versions.electron, chromium: process.versions.chrome, platform: process.platform }, coordinates: 'CSS pixels; client relative to website viewport; page includes scroll; normalized element offsets included', limitations: ['Main frame and uniquely identified nested frames; transformed frame geometry is unsupported', 'No screenshots, clipboard contents, cookies, or network bodies', 'Login secrets encrypted locally; other sensitive fields redacted', 'Input values limited to 10000 characters; scrolling is coalesced'] }, null, 2), { mode: 0o600 })).catch(error => { this.error = String(error) })
  }
  append(type: string, url: string, data: Record<string, unknown>): RecordedEvent | null {
    if (this.state !== 'recording' || this.error) return null
    if (typeof data.secretValue === 'string') {
      const { secretValue, ...safe } = data
      data = { ...safe, value: '[ENCRYPTED]', encryptedValue: this.secrets.encrypt(secretValue, this.id + ':' + url) }
    }
    if (type === 'input') this.inputsDirty = true
    const event: RecordedEvent = { sequence: ++this.count, timestamp: new Date().toISOString(), elapsedMs: Date.now() - this.startedAt, type, url, data }
    const line = JSON.stringify(event) + '\n'
    this.queue = this.queue.then(() => appendFile(this.eventsPath, line, { mode: 0o600 })).catch(error => { this.error = String(error) })
    return event
  }
  encryptInput(event: RecordedEvent, value: string) { return this.secrets.encrypt(value, this.id + ':' + event.url) }
  decryptInput(event: RecordedEvent) { return this.secrets.decrypt(event.data.encryptedValue, this.id + ':' + event.url) }
  status(): RecordingStatus { return { id: this.id, state: this.state, eventCount: this.count, path: this.directory, error: this.error, secretSync: this.secretSync } }
  async flush() { await this.queue; if (this.error) throw new Error(this.error) }
  async stop(saveForNode = false, syncSecrets = true) {
    this.state = 'stopped'
    const saving = this.stopQueue.then(async () => {
      await this.flush()
      await writeFile(join(this.directory, 'finished.json'), JSON.stringify({ endedAt: new Date().toISOString(), eventCount: this.count }), { mode: 0o600 })
      if (saveForNode && this.count > 0) {
        const events = JSON.parse(await this.exportJSON()).events as RecordedEvent[]
        if (events.some(event => ['click', 'input', 'keydown', 'scroll'].includes(event.type))) {
          const path = RecordingStore.nodePath(this.root, this.workflowId, this.nodeId)
          await mkdir(join(this.root, '.saved-nodes'), { recursive: true, mode: 0o700 })
          await writeFile(path + '.tmp', JSON.stringify({ recordingId: this.id }), { mode: 0o600 })
          await rename(path + '.tmp', path)
        }
      }
      if (saveForNode && syncSecrets && (this.inputsDirty || this.secretSync !== 'saved')) await this.syncSecrets()
      return this.status()
    })
    this.stopQueue = saving.then(() => {}, () => {})
    return saving
  }
  private secretContext() { return JSON.stringify(['recording', this.workflowId, this.nodeId, this.id]) }
  async syncSecrets(recovered?: { events: RecordedEvent[]; inputs: import('./replaySettings').SavedInput[] }) {
    const task = this.secretSyncQueue.then(async () => {
      const data = recovered ?? JSON.parse(await this.exportJSON())
      const events = data.events.filter((event: RecordedEvent) => event.type === 'input').map((event: RecordedEvent) => ({ sequence: event.sequence, data: { value: event.data.value, encryptedValue: event.data.encryptedValue, checked: event.data.checked, selectedValues: event.data.selectedValues } }))
      const inputs = data.inputs
      if (!events.length && !inputs.length) return
      this.secretSync = 'pending'
      try {
        await recordingSecretsBackend(this.secrets, this.secretContext(), { version: 2, events, inputs })
        this.secretSync = 'saved'
        this.inputsDirty = false
      } catch { this.secretSync = 'failed' }
      await writeFile(join(this.directory, 'credential-sync.json'), JSON.stringify({ status: this.secretSync }), { mode: 0o600 })
    })
    this.secretSyncQueue = task.catch(() => {})
    await task
    return this.status()
  }
  async replayData(): Promise<{ events: RecordedEvent[]; inputs: import('./replaySettings').SavedInput[]; inputSource: 'backend' | 'local' }> {
    await this.secretSyncQueue
    const data = JSON.parse(await this.exportJSON())
    data.inputSource = 'local'
    try {
      const backup = await recordingSecretsBackend(this.secrets, this.secretContext()) as { version?: number; events: { sequence: number; encryptedValue?: unknown; data?: Record<string, unknown> }[]; inputs: import('./replaySettings').SavedInput[] } | null
      if (backup) {
        for (const event of data.events as RecordedEvent[]) {
          if (event.type !== 'input') continue
          const saved = backup.events.find(item => item.sequence === event.sequence)
          if (backup.version === 2 && saved?.data) event.data = { ...event.data, ...saved.data }
          else if (saved?.encryptedValue) event.data.encryptedValue = saved.encryptedValue
        }
        if (backup.version === 2) data.inputs = backup.inputs
        else {
          for (const replacement of backup.inputs) {
            data.inputs = data.inputs.filter((input: { sequence: number }) => input.sequence !== replacement.sequence)
            data.inputs.push({ ...replacement, label: 'Saved password', value: '', secret: true })
          }
        }
        data.inputSource = 'backend'
      }
      // Upgrade existing password-only backups and previously local recordings.
      if (!backup || backup.version !== 2) {
        await this.syncSecrets(data)
        if (this.secretSync === 'saved') data.inputSource = 'backend'
      }
    } catch { /* Keep offline replay available using the last local recording. */ }
    return data
  }
  private static nodePath(root: string, workflowId: string, nodeId: string) {
    return join(root, '.saved-nodes', createHash('sha256').update(JSON.stringify([workflowId, nodeId])).digest('hex') + '.json')
  }
  static async restore(root: string, workflowId: string, nodeId: string): Promise<RecordingStore | null> {
    let reference: { recordingId: string }
    try { reference = JSON.parse(await readFile(this.nodePath(root, workflowId, nodeId), 'utf8')) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
    if (!/^[a-f0-9-]{36}$/.test(reference.recordingId)) throw new Error('Invalid saved recording reference.')
    const directory = join(root, reference.recordingId)
    const metadata = JSON.parse(await readFile(join(directory, 'session.json'), 'utf8'))
    if (metadata.id !== reference.recordingId || metadata.workflowId !== workflowId || metadata.nodeId !== nodeId) throw new Error('Saved recording does not belong to this workflow step.')
    const finished = JSON.parse(await readFile(join(directory, 'finished.json'), 'utf8'))
    const restored = new RecordingStore(root, workflowId, nodeId, { id: metadata.id, startedAt: metadata.startedAt, count: finished.eventCount })
    try { restored.secretSync = JSON.parse(await readFile(join(directory, 'credential-sync.json'), 'utf8')).status } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    return restored
  }
  planHash(steps: RecordedEvent[]) { return createHash('sha256').update(JSON.stringify(steps)).digest('hex') }
  async saveReplay(status: ReplayStatus, planHash: string) {
    const data = JSON.stringify({ ...status, workflowId: this.workflowId, recordingId: this.id, planHash, checkpointVersion: 1, updatedAt: new Date().toISOString() }, null, 2)
    const task = this.replayQueue.then(async () => {
      const temp = join(this.directory, 'last-replay.json.tmp')
      await writeFile(temp, data, { mode: 0o600 })
      await rename(temp, join(this.directory, 'last-replay.json'))
      if (status.runId && ['completed', 'failed', 'unknown', 'cancelled'].includes(status.state)) {
        await mkdir(join(this.directory, 'runs'), { recursive: true, mode: 0o700 })
        const report = join(this.directory, 'runs', status.runId + '.json')
        await writeFile(report + '.tmp', data, { mode: 0o600 })
        await rename(report + '.tmp', report)
      }
    })
    this.replayQueue = task.catch(() => {})
    await task
  }
  async loadReplay(planHash: string): Promise<ReplayStatus> {
    await this.replayQueue
    const saved = JSON.parse(await readFile(join(this.directory, 'last-replay.json'), 'utf8'))
    if (saved.checkpointVersion !== 1 || saved.recordingId !== this.id || saved.workflowId !== this.workflowId || saved.planHash !== planHash) throw new Error('Resume rejected: recording or input values changed.')
    if (saved.resumable === false) throw new Error('Resume was rejected; the saved browser checkpoint is no longer valid.')
    if (!['failed', 'unknown', 'cancelled', 'running'].includes(saved.state)) throw new Error('This run does not need resuming.')
    return saved
  }
  async runArtifact(runId: string, artifactId: string) {
    if (!/^[a-f0-9-]{36}$/.test(runId)) throw new Error('Invalid run.')
    await this.replayQueue
    const report = JSON.parse(await readFile(join(this.directory, 'runs', runId + '.json'), 'utf8')) as ReplayStatus
    const file = report.artifacts?.find(item => item.id === artifactId && item.state === 'completed')
    if (!file || basename(file.path) !== artifactId) throw new Error('Saved download not found.')
    const root = await realpath(join(this.directory, 'downloads'))
    const path = await realpath(file.path)
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error('Invalid saved file.')
    return { ...file, path }
  }
  async artifactPreview(runId: string, artifactId: string) {
    const file = await this.runArtifact(runId, artifactId)
    if (!['.csv', '.txt', '.json', '.log'].includes(extname(file.path).toLowerCase())) return 'Preview unavailable for this file type. Use Show in folder.'
    if ((await stat(file.path)).size > 128 * 1024) return 'This file is too large for an inline preview. Use Show in folder.'
    return readFile(file.path, 'utf8')
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
