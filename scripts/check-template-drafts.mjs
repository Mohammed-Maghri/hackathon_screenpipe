// Run with npm run test:template-drafts. Uses an isolated desktop profile and a durable HTTP fixture.
import electronPath from 'electron'
import { build } from 'esbuild'
const draftBundle = (await build({ entryPoints: ['src/renderer/src/data/workflowDrafts.ts'], bundle: true, write: false, format: 'iife', globalName: 'GhostDraftFixture' })).outputFiles[0].text
const sourceTemplate = { name: 'Draft regression', description: 'Saved draft fixture', apps: ['Chrome'], steps: ['Collect report', 'Review report', 'Export report'] }
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createWorkflowSchema, updateWorkflowSchema } from '../backend/dist/modules/workflows/workflow.schemas.js'
import { configureNodeContracts } from '../backend/dist/modules/workflows/node-contract.js'

const profile = await mkdtemp(join(tmpdir(), 'ghost-template-drafts-'))
const database = join(profile, 'workflow-fixture.json')
await writeFile(database, '[]')
const read = async () => JSON.parse(await readFile(database, 'utf8'))
let failCreate = false, failSave = false, holdSave = false, releaseSave
let activeWrites = 0, maxWrites = 0, creates = 0, patches = 0
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  try {
    const url = new URL(req.url, 'http://localhost')
    if (req.method === 'POST' || req.method === 'PATCH') {
      let body = ''; for await (const part of req) body += part
      if (req.method === 'POST') {
        creates++
        if (failCreate) { res.writeHead(503); res.end('{}'); return }
        const data = createWorkflowSchema.parse(JSON.parse(body))
        data.nodes = configureNodeContracts(data.nodes, data.edges)
        const workflow = { ...data, id: crypto.randomUUID(), updatedAt: new Date().toISOString() }
        await writeFile(database, JSON.stringify([workflow, ...await read()]))
        res.end(JSON.stringify(workflow)); return
      }
      patches++; activeWrites++; maxWrites = Math.max(maxWrites, activeWrites)
      try {
        const data = updateWorkflowSchema.parse(JSON.parse(body))
        if (data.nodes && data.edges) data.nodes = configureNodeContracts(data.nodes, data.edges)
        if (failSave) { res.writeHead(503); res.end('{}'); return }
        if (holdSave) await new Promise(resolve => { releaseSave = resolve })
        const all = await read(), index = all.findIndex(w => w.id === url.pathname.split('/').at(-1))
        const workflow = { ...all[index], ...data, updatedAt: new Date().toISOString() }
        all[index] = workflow; await writeFile(database, JSON.stringify(all)); res.end(JSON.stringify(workflow)); return
      } finally { activeWrites-- }
    }
    const all = await read()
    if (url.pathname === '/api/workflows') {
      const status = url.searchParams.get('status'), search = url.searchParams.get('search')?.toLowerCase()
      const found = all.filter(w => (!status || status === w.status) && (!search || w.name.toLowerCase().includes(search)))
      const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 20)
      res.end(JSON.stringify({ items: found.slice(offset, offset + limit).map(w => ({ ...w, _count: { nodes: w.nodes.length, edges: w.edges.length } })), total: found.length })); return
    }
    const workflow = all.find(w => w.id === url.pathname.split('/').at(-1))
    if (!workflow) res.writeHead(404)
    res.end(JSON.stringify(workflow ?? {}))
  } catch (error) { res.writeHead(400); res.end(JSON.stringify({ error: String(error) })) }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const debug = 9297, backend = `http://127.0.0.1:${server.address().port}`
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(check, message) {
  for (let attempt = 0; attempt < 150; attempt++) { if (await check()) return; await pause(40) }
  throw new Error(message)
}
let child, host, cdp, stderr = '', socket
async function start() {
  child = spawn(electronPath, ['.', `--remote-debugging-port=${debug}`, `--user-data-dir=${profile}`], { env: { ...process.env, GHOST_BACKEND_URL: backend }, stdio: ['ignore', 'ignore', 'pipe'] })
  child.stderr.on('data', data => { stderr += data })
  let target
  await until(async () => { try { target = (await (await fetch(`http://127.0.0.1:${debug}/json`)).json()).find(p => p.url.includes('index.html')); return target } catch { return false } }, 'Desktop did not start')
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let seq = 0; const pending = new Map()
  socket.onmessage = event => { const data = JSON.parse(event.data); if (data.id) { const entry = pending.get(data.id); if (!entry) return; pending.delete(data.id); clearTimeout(entry.timer); data.error ? entry.reject(new Error(JSON.stringify(data.error))) : entry.resolve(data.result) } }
  cdp = (method, params) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timed out')) }, 10000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })) })
  host = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  await until(() => host('!!window.ghost?.createWorkflow'), 'Preload missing')
  await host(draftBundle)
}
async function stop() {
  socket?.close()
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  for (let attempt = 0; attempt < 30 && child.exitCode === null; attempt++) await pause(50)
  if (child.exitCode === null) child.kill('SIGKILL')
  await pause(150)
}
const click = selector => host(`document.querySelector(${JSON.stringify(selector)}).click()`)
const field = (selector, value) => host(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); const proto = e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`)
async function rename(name) {
  await click('[aria-label="Rename workflow"]'); await field('[aria-label="Workflow name"]', name)
  await host(`document.querySelector('[aria-label="Workflow name"]').blur()`)
}
const watchdog = setTimeout(() => { child?.kill('SIGKILL'); console.error('Template fixture timed out'); process.exit(1) }, 90000)
try {
  await start(); await host("location.hash='/dashboard'")
  // Templates navigation was intentionally removed. Exercise its retained payload
  // helper through the real IPC, then test the visible saved-draft editor.
  const templateName = sourceTemplate.name
  const createCopy = () => host(`window.ghost.createWorkflow(GhostDraftFixture.templateDraft(${JSON.stringify(sourceTemplate)}))`)
  failCreate = true; assert.equal((await createCopy()).ok, false); assert.equal((await read()).length, 0)
  failCreate = false
  const created = await createCopy(); assert.equal(created.ok, true)
  await host(`location.hash='/workflows/${created.workflow.id}'`)
  await until(() => host('document.querySelectorAll(\'.canvas-node\').length===4'), 'Saved draft did not open')
  let [saved] = await read(); const id = saved.id, route = `/workflows/${id}`
  assert.equal(creates, 2); assert.equal(saved.status, 'DRAFT'); assert.equal(saved.edges.length, 3); assert.equal(patches, 0)
  const browserId = saved.nodes.find(n => n.config.stepType === 'browser').id
  await host(`document.querySelector('.node-${browserId}').dispatchEvent(new MouseEvent('dblclick',{bubbles:true,detail:2}))`)
  await until(() => host('!!document.querySelector(\'[aria-label="Browser step name"]\')'), 'Node settings missing')
  await field('[aria-label="Browser step name"]', 'My saved template step'); await field('[aria-label="Node description"]', 'My own description')
  await click('[aria-label="Close dialog"]')
  await until(async () => (await read())[0].nodes.some(n => n.label === 'My saved template step' && n.config.description === 'My own description'), 'Node edits were not autosaved')
  const point = await host(`(() => { const r=document.querySelector('.node-${browserId} .node-heading').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2} })()`)
  const initialX = (await read())[0].nodes.find(n => n.id === browserId).positionX
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x+30, y: point.y+15, buttons: 1 })
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x+30, y: point.y+15, button: 'left', clickCount: 1 })
  await until(async () => (await read())[0].nodes.find(n => n.id === browserId).positionX > initialX, 'Dragged position was not autosaved')
  async function add(action) {
    await click('[aria-label="Add to workflow"]'); await until(() => host("!!document.querySelector('.canvas-add-menu:popover-open')"), 'Add menu missing')
    await host(`[...document.querySelectorAll('.canvas-add-menu button')].find(b=>b.textContent===${JSON.stringify(action)}).click()`)
    await until(() => host("!!document.querySelector('dialog[open]')"), 'Add dialog missing')
  }
  await add('Add node'); await host("[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Integration node').click()")
  await until(() => host("!!document.querySelector('[aria-label=\"Node inspector\"]')"), 'New node settings missing'); await click('[aria-label="Close dialog"]')
  await until(async () => (await read())[0].nodes.length === 5 && (await read())[0].edges.length === 4, 'Added node/edge not autosaved')
  const addedId = (await read())[0].nodes.find(n => n.label === 'New action').id
  await add('Add connection')
  await host(`(() => { const selects=document.querySelectorAll('dialog select'); selects[0].value=${JSON.stringify(saved.nodes[0].id)};selects[0].dispatchEvent(new Event('change',{bubbles:true}));selects[1].value=${JSON.stringify(addedId)};selects[1].dispatchEvent(new Event('change',{bubbles:true})); })()`)
  await host("document.querySelector('dialog form').requestSubmit()")
  await until(async () => (await read())[0].edges.length === 5, 'Added connection not autosaved')
  const edgeIds = (await read())[0].edges.map(e=>e.id).sort()
  await rename('My template draft'); await until(async () => (await read())[0].name === 'My template draft', 'Name not autosaved')
  assert.deepEqual((await read())[0].edges.map(e=>e.id).sort(), edgeIds, 'Autosave must retain edge identities');
  await click('[aria-label="Delete selected node"]'); await until(() => host("!!document.querySelector('dialog[open]')"), 'Delete dialog missing'); await host("[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='Delete node').click()");
  await until(async () => (await read())[0].nodes.length === 4 && (await read())[0].edges.length === 3, 'Node deletion not autosaved')
  // Two edits while the first write is held must be written in order.
  holdSave = true; await rename('First queued name'); await until(() => Boolean(releaseSave), 'Held save did not start')
  await rename('Latest queued name'); await pause(650); assert.equal(activeWrites, 1)
  holdSave = false; releaseSave(); releaseSave = undefined
  await until(async () => (await read())[0].name === 'Latest queued name', 'Older response overwrote latest edits'); assert.equal(maxWrites, 1)
  await rename('Fast navigation draft'); await host("location.hash='/workflows'")
  await until(async () => (await read())[0].name === 'Fast navigation draft', 'Navigation did not flush changes')
  await until(() => host("!!document.querySelector('.workflow-tabs')"), 'Workflows missing')
  await host("[...document.querySelectorAll('.workflow-tabs button')].find(b=>b.textContent==='Drafts').click()")
  await until(() => host("document.querySelector('.workflow-card-grid')?.textContent.includes('Fast navigation draft')"), 'Draft missing from Drafts')
  await stop(); await start(); await host(`location.hash=${JSON.stringify(route)}`)
  await until(() => host("document.querySelector('.editor-title-row h1')?.textContent.includes('Fast navigation draft')"), 'Draft not restored after app restart')
  assert.ok(await host("document.querySelector('.canvas-node') && document.body.textContent.includes('My saved template step')"))
  // Failed edits remain recoverable across another full restart.
  failSave = true; await rename('Recovered after failed save')
  await until(() => host("[...document.querySelectorAll('button')].some(b=>b.textContent==='Retry save')"), 'Save failure has no retry')
  await stop(); failSave = false; await start(); await host(`location.hash=${JSON.stringify(route)}`)
  await until(async () => (await read())[0].name === 'Recovered after failed save', 'Unsaved draft recovery failed')
  await until(() => host("document.querySelector('.editor-save-state')?.textContent==='Saved to backend'"), 'Recovered save never settled')
  assert.equal(await host(`localStorage.getItem('ghost.pending-draft.${id}')`), null)
  const second = await createCopy(); assert.equal(second.ok, true)
  await until(async () => (await read()).length === 2, 'Second template copy missing')
  const copies = await read(); assert.notEqual(copies[0].id, copies[1].id); assert.equal(copies[0].name, templateName); assert.equal(new Set(copies.flatMap(w => w.nodes.map(n => n.id))).size, 8)
  assert.ok(!/UnhandledPromiseRejection|Uncaught TypeError/.test(stderr), stderr)
  console.log('PASS template drafts: native create/save IPC, backend graph validation, creation failure/retry, autosaved names/node details/drag/graph edits, stable edge IDs, serialized writes, fast navigation, Drafts listing, full app restarts and failed-save recovery, reusable original template')
} finally { clearTimeout(watchdog); releaseSave?.(); await stop(); server.closeAllConnections(); server.close() }
