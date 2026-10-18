import { RecordingSecrets } from './recordingSecrets'
import type { SavedLogin } from '../shared/login'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import nova from './prelearned/nova.json'
import forma from './prelearned/forma.json'
import { RecordingStore } from './recordingStore'
import { prepareReplay } from './prepareReplay'
import type { RecordedEvent } from '../shared/recording'
const templates = [nova, forma]
const hash = (events: RecordedEvent[]) => createHash('sha256').update(JSON.stringify(events)).digest('hex')
const pending = new Map<string, Promise<void>>()
export function installPrelearnedBrowser(root: string, workflowId: string, nodeId: string, url: string): Promise<void> {
  const key = JSON.stringify([root, workflowId, nodeId])
  const existing = pending.get(key); if (existing) return existing
  const task = (async () => {
    const template = templates.find(item => url === 'https://hackathon-screenpipe.vercel.app' + (item.scenario === 'nova' ? '/nova/restocking' : '/finance'))
    if (!template) return
    await ensurePreparedLogin(root, workflowId, nodeId, template.scenario)
    // Login is node-scoped; a replacement recording retains it.
    if (await RecordingStore.restore(root, workflowId, nodeId)) return
    const events = template.events as RecordedEvent[]
    const plan = prepareReplay(events)
    if (plan.preview.blockers.length || hash(plan.steps) !== template.sourcePlanHash) throw new Error('Bundled browser task failed integrity validation.')
    const recording = new RecordingStore(root, workflowId, nodeId)
    await recording.flush()
    await writeFile(recording.eventsPath, events.map(event => JSON.stringify(event)).join('\n')+'\n', {mode:0o600})
    recording.count = events.length
    await writeFile(join(recording.directory, 'teaching-source.json'), JSON.stringify({scenario:template.scenario, verifiedAt:template.verifiedAt, sourceRecordingId:template.sourceRecordingId, planHash:template.sourcePlanHash}), {mode:0o600})
    await recording.stop(true, false)
  })().finally(() => pending.delete(key))
  pending.set(key, task); return task
}
export async function prelearnedSource(recording: RecordingStore) {
  let source: {scenario: string; planHash: string}
  try { source = JSON.parse(await readFile(join(recording.directory, 'teaching-source.json'), 'utf8')) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
  const template = templates.find(item => item.scenario === source.scenario && item.sourcePlanHash === source.planHash)
  if (!template) return null
  const data = JSON.parse(await recording.exportJSON())
  const plan = prepareReplay(data.events, data.inputs)
  return !plan.preview.blockers.length && hash(plan.steps) === template.sourcePlanHash ? template : null
}

const loginContext = (workflowId: string, nodeId: string) => JSON.stringify(['prepared-login-v1', workflowId, nodeId])
function loginPath(root: string, context: string) { return join(root, '.prepared-logins', createHash('sha256').update(context).digest('hex')+'.json') }
async function ensurePreparedLogin(root: string, workflowId: string, nodeId: string, scenario: string) {
  const context = loginContext(workflowId, nodeId)
  const path = loginPath(root, context)
  try { await readFile(path); return } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  const base = 'https://hackathon-screenpipe.vercel.app'
  const nova = scenario === 'nova'
  const login: SavedLogin = {loginURL:base+(nova?'/nova/login':'/login'), successURL:base+(nova?'/nova':'/finance'), username:nova?'alex@nova.test':'demo@forma.test', password:nova?'nova-demo':'ghost-demo', remember:true}
  const secrets = new RecordingSecrets(join(root, '.secrets'))
  await mkdir(join(root, '.prepared-logins'), {recursive:true, mode:0o700})
  try { await writeFile(path, JSON.stringify(secrets.encrypt(JSON.stringify(login), context)), {mode:0o600, flag:'wx'}) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
}
export async function preparedLogin(root: string, workflowId: string, nodeId: string, targetURL: string): Promise<SavedLogin | null> {
  const context = loginContext(workflowId, nodeId)
  let value: unknown
  try { value = JSON.parse(await readFile(loginPath(root, context), 'utf8')) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
  const login = JSON.parse(new RecordingSecrets(join(root, '.secrets')).decrypt(value, context)) as SavedLogin
  const target = new URL(targetURL)
  if (target.origin !== 'https://hackathon-screenpipe.vercel.app' || target.username || target.password) return null
  if (login.loginURL.endsWith('/nova/login') ? !target.pathname.startsWith('/nova') : !['/finance','/users','/login','/'].includes(target.pathname)) return null
  return login
}
