// Real Home form -> sandboxed preload -> main IPC -> actual Fastify endpoint.
// No database or AI provider is accessed.
import electronPath from 'electron'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { GHOST_SYSTEM_PROMPT } from '../backend/dist/modules/discovery/discovery.prompt.js'
import { buildApp } from '../backend/dist/app.js'
const originalFetch = globalThis.fetch
let formatCalls = 0
// Only the provider is doubled; the actual formatter route and validation run.
globalThis.fetch = async (url, init) => {
  if (String(url) !== 'https://api.openai.com/v1/responses') return originalFetch(url, init)
  formatCalls++
  const request = JSON.parse(String(init.body))
  assert.equal(request.text.format.type, 'json_schema')
  const data = JSON.parse(request.input[0].content)
  const result = JSON.parse(data.screenpipeAnswer)
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]})
}
let saved = []
const env = { NODE_ENV: 'test', LOG_LEVEL: 'silent', CORS_ORIGINS: [], DATABASE_URL: 'postgresql://unused:unused@localhost/unused', OPENAI_API_KEY: 'test-only' }
const database = {
  $disconnect: async () => {},
  $transaction: operations => typeof operations === 'function' ? operations(database) : Promise.all(operations),
  workflow: {
    findMany: async ({ skip, take }) => saved.slice(skip, skip + take).map(item => ({ ...item, _count: { nodes: item.nodes.length, edges: item.edges.length } })),
    count: async () => saved.length,
    delete: async ({ where }) => { saved = saved.filter(item => item.id !== where.id) },
    findUnique: async ({ where }) => saved.find(item => item.id === where.id) ?? null,
    findUniqueOrThrow: async ({ where }) => { const item = saved.find(item => item.id === where.id); if (!item) throw Object.assign(Error('Missing workflow'), { statusCode: 404 }); return structuredClone(item) },
    create: async ({ data }) => { const item = { ...data, ownerId: null, updatedAt: new Date().toISOString(), nodes: [], edges: [] }; saved.push(item); return item },
    update: async ({ where, data }) => Object.assign(saved.find(item => item.id === where.id), data),
  },
  workflowNode: {
    createMany: async ({ data }) => { for (const node of data) saved.find(item => item.id === node.workflowId).nodes.push(node) },
    deleteMany: async ({ where }) => { saved.find(item => item.id === where.workflowId).nodes = [] },
  },
  workflowEdge: {
    createMany: async ({ data }) => { for (const edge of data) saved.find(item => item.id === edge.workflowId).edges.push(edge) },
    deleteMany: async ({ where }) => { saved.find(item => item.id === where.workflowId).edges = [] },
  },
  workflowRun: { count: async () => 0, deleteMany: async () => {} },
}
const finalDir = await mkdtemp('/tmp/ghost-pipe-final-')
let aiCalls = 0, ready = false, requested
const releaseAI = () => { ready = true }
const screenpipe = createServer(async (request, response) => {
  try {
    assert.equal(request.headers.authorization, 'Bearer test-screenpipe-token')
    const url = new URL(request.url, 'http://localhost')
    response.setHeader('Content-Type', 'application/json')
    if (url.pathname === '/pipes/ghost-workflow-discovery') return response.end(JSON.stringify({ config: { name: 'ghost-workflow-discovery' } }))
    if (url.pathname.endsWith('/run')) {
      const chunks=[]; for await (const chunk of request) chunks.push(chunk)
      requested = JSON.parse(Buffer.concat(chunks).toString()).run_context
      assert.equal(requested.systemPrompt, GHOST_SYSTEM_PROMPT)
      assert.equal(requested.prompt, '  Find my reporting routine\nKeep original whitespace 🚀  ')
      aiCalls++
      return response.end(JSON.stringify({success:true,execution_id:42}))
    }
    assert.equal(url.pathname, '/pipes/ghost-workflow-discovery/executions')
    assert.equal(url.searchParams.get('include_output'), 'false')
    if (ready) await writeFile(`${finalDir}/${requested.requestId}.json`,JSON.stringify({requestId:requested.requestId,workflow:{name:'Generated reporting board',description:'Agent reporting routine'},missingInformation:[],steps:[
      {id:'step_1',name:'Review dashboard',description:'Review metrics',application:'Chrome',type:'browser',startUrl:'https://example.com/dashboard',basis:'observed',references:['screenpipe://frame/10'],missingInformation:[]},
      {id:'step_2',name:'Prepare spreadsheet',description:'Prepare report',application:'Excel',type:'application',startUrl:null,basis:'inferred',references:[],missingInformation:['Confirm spreadsheet columns']},
    ]}))
    response.end(JSON.stringify({data:[{id:42,pipe_name:'ghost-workflow-discovery',status:ready?'completed':'running'}]}))
  } catch (error) { response.statusCode=500; response.end(JSON.stringify({error:String(error)})) }
})
screenpipe.listen(0, '127.0.0.1'); await once(screenpipe, 'listening')
const backend = await buildApp(env, database)
const requests = []
backend.addHook('preHandler', async request => { if (request.url === '/api/workflow-discovery/format') requests.push(request.body) })
const address = await backend.listen({ port: 0, host: '127.0.0.1' })
const profile = await mkdtemp('/tmp/ghost-discovery-test-')
const child = spawn(electronPath, ['.', '--ozone-platform=x11', '--remote-debugging-port=0', `--user-data-dir=${profile}`], { env: { ...process.env, GHOST_BACKEND_URL: address, SCREENPIPE_LOCAL_API_URL: `http://127.0.0.1:${screenpipe.address().port}`, SCREENPIPE_LOCAL_API_KEY: 'test-screenpipe-token', SCREENPIPE_DISCOVERY_OUTPUT_DIR: finalDir }, stdio: ['ignore', 'ignore', 'pipe'] })
let logs = '', socket
child.stderr.on('data', data => { logs += data })
async function until(fn) { for (let i = 0; i < 200; i++) { const value = await fn(); if (value) return value; await new Promise(r => setTimeout(r, 50)) } throw new Error('Timed out') }
try {
  const port = await until(() => logs.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)?.[1])
  const target = await until(async () => (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(page => page.url.includes('index.html')))
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let id = 0
  const pending = new Map()
  socket.onmessage = event => { const data = JSON.parse(event.data); if (data.id) { pending.get(data.id)?.(data); pending.delete(data.id) } }
  async function evaluate(expression) {
    const n = ++id
    const response = new Promise(resolve => pending.set(n, resolve))
    socket.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }))
    const result = await Promise.race([response, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('CDP timeout')), 15000); timer.unref() })])
    if (result.error || result.result.exceptionDetails) throw new Error(JSON.stringify(result))
    return result.result.result.value
  }
  await evaluate("location.hash='/dashboard'")
  await until(() => evaluate('!!window.ghost?.prepareDiscovery && !!document.querySelector(".home-dashboard textarea")'))
  // Keep this isolated fixture out of the user's active desktop workspace.
  await evaluate("window.ghost.controlWindow('minimize')")
  await until(() => evaluate(`document.querySelector('.discovery-panel .empty-state h3')?.textContent === 'Your first workflow starts here'`))
  assert.equal(await evaluate(`document.querySelector('.discovery-panel').textContent.includes('Daily Orders Report')`), false)
  const original = '  Find my reporting routine\nKeep original whitespace 🚀  '
  await evaluate(`(() => { const field = document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, ${JSON.stringify(original)}); field.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await evaluate(`document.querySelector('.discovery-composer button[type="submit"]').click()`)
  await until(() => evaluate(`document.querySelector('.discovery-composer button[type="submit"]').textContent.includes('Generating') && document.querySelector('.discovery-composer button[type="submit"]').disabled`))
  await evaluate(`document.querySelector('.discovery-composer button[type="submit"]').click()`)
  await until(() => aiCalls === 1)
  assert.equal(saved.length, 0, 'No board saved before the AI finishes')
  assert.equal(await evaluate(`!!document.querySelector('.generation-card[aria-busy="true"]')`), true)
  assert.equal(await evaluate(`document.querySelector('.generation-card').textContent.includes('Generating')`), true)
  releaseAI()
  await until(() => evaluate(`!!document.querySelector('[data-page="workflow-editor"]')`))
  assert.equal(formatCalls, 1); assert.equal(requests.length, 1); assert.equal(requests[0].prompt, original)
  assert.equal(saved.length, 1); assert.equal(saved[0].nodes.length, 2); assert.equal(saved[0].edges.length, 1)
  assert.equal(await evaluate(`document.querySelectorAll('.canvas-node').length`), 2)
  assert.equal(saved[0].nodes[0].config.source, 'screenpipe_pipe')
  assert.deepEqual(saved[0].nodes[0].config.evidenceIds, [])
  assert.equal(await evaluate(`document.body.textContent.includes('Development mock')`), false)
  const browserNode = saved[0].nodes.find(node => node.config.stepType === 'browser')
  const teachingURL = address + '/health'
  await evaluate(`window.__teachingState=null;window.ghost.browser.onState(value=>window.__teachingState=value)`)
  await evaluate(`document.querySelector('.node-${browserNode.id}').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }))`)
  await until(()=>evaluate(`!!document.querySelector('[aria-label="Starting dashboard URL"]')`))
  assert.equal(await evaluate(`document.querySelector('.evidence-heading').textContent.includes('Evidence (0)')`), true)
  await evaluate(`(()=>{const input=document.querySelector('[aria-label="Starting dashboard URL"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(teachingURL)});input.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await evaluate(`document.querySelector('.recording-button.dash-button--primary').click()`)
  await until(()=>saved[0].nodes.find(node=>node.id===browserNode.id)?.config.startUrl===teachingURL)
  await until(()=>evaluate(`window.__teachingState?.url===${JSON.stringify(teachingURL)} && !window.__teachingState.loading`)).catch(async error => { console.error('Teaching diagnostic', await evaluate(`({ state: window.__teachingState, text: document.body.innerText.slice(-1200) })`)); throw error })
  await evaluate('location.reload()')
  await until(()=>evaluate(`document.querySelector('[aria-label="Website address"]')?.value===${JSON.stringify(teachingURL)} && !document.querySelector('[aria-label="Website address"]').disabled`))
  await evaluate(`location.hash='/workflows/${saved[0].id}'`)
  await until(()=>evaluate(`document.querySelectorAll('.canvas-node').length===2`))

  await evaluate(`location.reload()`)
  await until(() => evaluate(`document.querySelectorAll('.canvas-node').length === 2`))
  await evaluate(`document.querySelector('[aria-label="Rename workflow"]').click()`)
  await evaluate(`(() => { const field = document.querySelector('[aria-label="Workflow name"]'); field.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'Edited saved board'); field.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  // Offscreen/background macOS windows may not give .focus() native focus.
  // Send the bubbling blur event React receives from a real focus change.
  await evaluate(`(() => { const field = document.querySelector('[aria-label="Workflow name"]'); field.blur(); field.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); })()`)
  await until(() => evaluate(`document.querySelector('h1')?.textContent.includes('Edited saved board')`))
  // Saved drafts autosave; no manual Save button is shown when autosave is enabled.
  await until(() => saved[0].name === 'Edited saved board')
  await until(() => evaluate(`document.querySelector('.editor-save-state')?.textContent.includes('Saved to backend')`))
  await evaluate(`location.reload()`)
  await until(() => evaluate(`(document.querySelector('h1')?.textContent.includes('Edited saved board') || document.querySelector('[aria-label="Workflow name"]')?.value === 'Edited saved board')`)).catch(async error => { console.error('Reload diagnostic', await evaluate(`({hash: location.hash, headings: [...document.querySelectorAll('h1')].map(e=>e.textContent), text: document.body.innerText.slice(0,800)})`), saved.map(w=>({name:w.name,nodes:w.nodes.length}))); throw error })
  await evaluate(`location.hash='/dashboard'`)
  await until(() => evaluate(`document.querySelector('.discovery-panel')?.textContent.includes('Edited saved board')`))
  await evaluate(`location.hash='/workflows'`)
  await until(() => evaluate(`document.querySelector('.workflow-card-grid')?.textContent.includes('Edited saved board')`))
  assert.equal(await evaluate(`document.querySelector('.workflow-card-grid').textContent.includes('Daily Orders Report')`), false)
  await evaluate(`location.reload()`)
  await until(() => evaluate(`document.querySelector('.workflow-card-grid')?.textContent.includes('Edited saved board')`))
  await evaluate(`location.hash='/dashboard'`)
  await until(() => evaluate(`document.querySelector('.discovery-panel')?.textContent.includes('Edited saved board')`))
  await evaluate(`location.hash='/workflows'`)
  await until(() => evaluate(`!!document.querySelector('.workflow-card-grid button[title="Delete workflow"]')`))
  await evaluate(`document.querySelector('.workflow-card-grid button[title="Delete workflow"]').click()`)
  await until(() => evaluate(`document.body.textContent.includes('Delete workflow?')`))
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Cancel').click()`)
  assert.equal(saved.length, 1)
  await evaluate(`document.querySelector('.workflow-card-grid button[title="Delete workflow"]').click()`)
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Delete workflow').click()`)
  await until(() => saved.length === 0)
  await until(() => evaluate(`document.body.textContent.includes('Your first workflow starts here')`))
  await evaluate(`location.reload()`)
  await until(() => evaluate(`document.body.textContent.includes('Your first workflow starts here')`))
  await evaluate(`location.hash='/dashboard'`)
  await until(() => evaluate(`document.querySelector('.discovery-panel .empty-state h3')?.textContent === 'Your first workflow starts here'`))
  await backend.close()
  await evaluate(`document.querySelector('.discovery-panel [aria-label="Refresh workflows"]').click()`)
  await until(() => evaluate(`document.querySelector('.discovery-panel').textContent.includes('Unable to load workflows')`))
  await evaluate(`(() => { const field = document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, 'Retry reporting'); field.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await evaluate(`document.querySelector('.discovery-composer button[type="submit"]').click()`)
  await until(() => evaluate(`document.querySelector('.generation-card--failed')?.textContent.includes('Retry generation')`))
  assert.equal(await evaluate(`document.querySelector('.discovery-composer button[type="submit"]').disabled`), false)
  console.log('PASS: Screenpipe Pipe discovery (HTTP/final-file fixture), generating card, automatic board opening, app images, AI contract, no duplicate submit, saved board, starting URL autosave/teaching/reload, edit/save/reload, Home cards, delete cancellation/confirmation/reload and backend failures (AI/database doubles)')
} finally {
  globalThis.fetch = originalFetch
  releaseAI()
  await new Promise(resolve => screenpipe.close(resolve))
  socket?.close()
  if (child.exitCode === null) {
    const exited = once(child, 'exit')
    child.kill()
    const forceExit = setTimeout(() => child.kill('SIGKILL'), 2000)
    forceExit.unref()
    try { await exited } finally { clearTimeout(forceExit) }
  }
  await backend.close()
  await rm(finalDir, { recursive: true, force: true })
  await rm(profile, { recursive: true, force: true })
}
