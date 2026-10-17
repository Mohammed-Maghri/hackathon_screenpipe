// Real Electron + isolated profile and HTTP fixture. Never writes to user workflows.
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import electronPath from 'electron'
import { _electron } from 'playwright-core'

const profile = await mkdtemp(join(tmpdir(), 'ghost-blue-flow-'))
const screenshots = join(profile, 'screenshots')
await mkdir(screenshots)
const id = '20000000-0000-4000-8000-000000000000'
const ids = [1, 2, 3].map(n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`)
let workflow = {
  id, name: 'Monthly finance report', status: 'DRAFT', updatedAt: new Date().toISOString(),
  description: 'Collect the monthly report, review the totals, then share the approved report with the team. '.repeat(5),
  nodes: ids.map((id, index) => ({ id, type: 'ACTION', label: ['Collect finance report', 'Review totals', 'Share approved report'][index], positionX: 320, positionY: 80 + index * 230, config: { stepType: 'browser', status: 'needs_recording', application: 'Chrome', description: 'Review this browser step before teaching it.', instructions: ['Review the report'], startUrl: 'https://example.com' } })),
  edges: [{ id: '30000000-0000-4000-8000-000000000001', sourceNodeId: ids[0], targetNodeId: ids[1] }],
}
const original = structuredClone(workflow)
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const path = new URL(req.url, 'http://localhost').pathname
  if (req.method === 'PATCH') {
    let body = ''; for await (const part of req) body += part
    workflow = { ...workflow, ...JSON.parse(body), updatedAt: new Date().toISOString() }
  }
  res.end(JSON.stringify(path === '/api/workflows' ? { items: [{ ...workflow, applications: ['Chrome'], _count: { nodes: workflow.nodes.length, edges: workflow.edges.length } }], total: 1 } : path.includes('/schedules') ? [] : workflow))
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const app = await _electron.launch({ executablePath: electronPath, args: ['.', `--user-data-dir=${profile}`], env: { ...process.env, GHOST_BACKEND_URL: `http://127.0.0.1:${server.address().port}` } })
const page = await app.firstWindow()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async (check, message) => { for (let i = 0; i < 120; i++) { if (await check()) return; await pause(50) } throw Error(message) }
const route = async path => { await page.evaluate(path => { location.hash = path }, path); await pause(200) }
const size = async (width, height) => { await app.evaluate(({ BrowserWindow }, { width, height }) => BrowserWindow.getAllWindows()[0].setContentSize(width, height), { width, height }); await pause(120) }
const shot = name => page.screenshot({ path: join(screenshots, `${name}.png`) })
try {
  await page.waitForSelector('.appearance-selector')
  await page.locator('.appearance-selector button[value="light"]').click()
  if (!process.env.GHOST_LAYOUT_ONLY) {
  // Existing records open without a write or a schema/coordinate migration.
  console.log('Checking saved graph')
  await route(`/workflows/${id}`)
  await page.waitForSelector('.react-flow__node')
  await pause(700)
  assert.deepEqual(workflow, original, 'Opening a saved graph must not rewrite it')
  assert.equal(await page.locator('.react-flow__node').count(), 3)
  assert.equal(await page.locator('.react-flow__edge').count(), 1)
  assert.equal(await page.locator('.editor-description').getAttribute('open'), null)
  await page.locator(`[data-id="${ids[0]}"] .canvas-node`).click()
  assert.equal(await page.locator('.node-settings-panel').count(), 0, 'One click only selects')
  await page.locator(`[data-id="${ids[0]}"] .canvas-node`).dblclick()
  await page.waitForSelector('.node-settings-panel')
  await page.locator('[aria-label="Browser step name"]').fill('Collect the approved finance report')
  await page.getByRole('button', { name: 'Close node settings' }).click()
  await until(() => workflow.nodes[0].label === 'Collect the approved finance report', 'Node setting did not persist')
  await page.getByRole('button', { name: 'Fit canvas', exact: true }).click()
  await pause(350)
  const node = page.locator(`[data-id="${ids[0]}"] .node-heading`)
  const box = await node.boundingBox(), before = workflow.nodes[0].positionX
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 15, { steps: 8 })
  await page.mouse.up()
  await until(() => Math.abs(workflow.nodes[0].positionX - before) > 1, 'React Flow drag did not persist')
  const handle = async (id, type) => { const b = await page.locator(`[data-id="${id}"] .react-flow__handle-${type}`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
  const from = await handle(ids[1], 'bottom'), to = await handle(ids[2], 'top')
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up()
  await until(() => workflow.edges.length === 2, 'Connecting React Flow handles did not persist')
  assert.equal(workflow.edges[0].id, original.edges[0].id, 'Existing edge identity changed')
  assert.deepEqual(workflow.nodes.map(node => node.id), original.nodes.map(node => node.id))
  assert.equal(workflow.nodes[0].config.startUrl, original.nodes[0].config.startUrl)
  // Duplicate and cyclic links remain invalid through React Flow handles.
  const reverseFrom = await handle(ids[2], 'bottom'), reverseTo = await handle(ids[0], 'top')
  await page.mouse.move(reverseFrom.x, reverseFrom.y); await page.mouse.down(); await page.mouse.move(reverseTo.x, reverseTo.y, { steps: 12 }); await page.mouse.up(); await pause(650)
  assert.equal(workflow.edges.length, 2, 'A cycle was accepted')
  await page.reload(); await page.waitForSelector('.react-flow__node'); await pause(400)
  assert.equal(await page.locator('.react-flow__edge').count(), 2)
  assert.ok(await page.locator('.canvas-node').allTextContents().then(texts => texts.some(text => text.includes('Collect the approved finance report'))))
  await page.locator(`[data-id="${ids[0]}"].react-flow__node`).focus()
  await page.keyboard.press('Enter'); await page.waitForSelector('.node-settings-panel')
  await page.keyboard.press('Escape'); await page.waitForSelector('.node-settings-panel', { state: 'detached' })
  await page.getByRole('button', { name: 'Fit canvas', exact: true }).click(); await pause(200)
  const edgePoint = await page.locator('.react-flow__edge').last().evaluate(edge => { const path=edge.querySelector('path'); const point=path.getPointAtLength(path.getTotalLength()/2).matrixTransform(path.getScreenCTM()); return {x:point.x,y:point.y} })
  await page.mouse.click(edgePoint.x, edgePoint.y)
  await page.keyboard.press('Backspace')
  await until(() => workflow.edges.length === 1, 'Selected edge deletion did not persist')
  assert.equal(workflow.edges[0].id, original.edges[0].id)
  await until(async () => await page.locator('.react-flow__edge').count() === 1, 'Deleted edge still rendered')
  const reconnectFrom = await handle(ids[1], 'bottom'), reconnectTo = await handle(ids[2], 'top')
  await page.mouse.move(reconnectFrom.x, reconnectFrom.y); await page.mouse.down(); await page.mouse.move(reconnectTo.x, reconnectTo.y, {steps:12}); await page.mouse.up()
  await until(() => workflow.edges.length === 2, 'Reconnecting a deleted edge did not persist')
  assert.equal(await page.locator('.react-flow__edge.selected').count(), 0, 'Recreated edges must not inherit stale selection')
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.getByRole('button', { name: 'Toggle minimap', exact: true }).click()
  await page.waitForSelector('.react-flow__minimap')
  await page.getByRole('button', { name: 'Toggle minimap', exact: true }).click()
  await page.locator('.editor-actions summary').click()
  await page.getByRole('button', { name: 'Test run', exact: true }).click()
  assert.equal(await page.locator('.log-row').count(), 3)
  await page.getByRole('button', { name: 'Clear run logs and test results', exact: true }).click()
  assert.equal(await page.locator('.log-row').count(), 0)
  assert.equal(await page.locator('.react-flow__node').count(), 3)
  assert.equal(workflow.edges.length, 2, 'Clear results must retain the graph')
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click()
  await page.waitForSelector('.workspace-search-dialog [aria-label="Search results"] button')
  await page.locator('.workspace-search-dialog [aria-label="Search results"] button').first().click()
  await page.waitForSelector('.workspace-search-dialog', { state: 'detached' })
  // Whole-card opening and independent actions remain separate.
  await route('/workflows'); await page.waitForSelector('.workflow-library-card')
  for (const action of ['Run', 'Schedule', 'Delete']) {
    await page.getByRole('button', { name: `${action} ${workflow.name}`, exact: true }).click()
    await page.waitForSelector('dialog[open]')
    assert.equal(new URL(page.url()).hash, '#/workflows')
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  }
  const card = await page.locator('.workflow-library-card').boundingBox()
  await page.mouse.click(card.x + 12, card.y + 60)
  await page.waitForSelector('.react-flow__node')
  }
  console.log('Checking layouts')
  const layouts = []
  for (const theme of ['light', 'dark']) {
    await route('/settings/appearance')
    await page.locator(`.settings-shell .appearance-selector button[value="${theme}"]`).click()
    for (const [width, height] of [[1440, 960], [1024, 768], [760, 620]]) {
      await size(width, height)
      for (const [name, path, selector] of [['home', '/dashboard', '.dashboard-scroll'], ['workflows', '/workflows', '.workflow-library-card'], ['editor', `/workflows/${id}`, '.react-flow'], ['settings', '/settings/appearance', '.settings-shell .appearance-selector'], ['welcome', '/welcome', '.welcome-main']]) {
        await route(path)
        await page.waitForSelector(selector)
        // scrollWidth rounds up while innerWidth rounds down on fractional Linux scaling.
        const geometry = await page.evaluate(() => ({ width: innerWidth, viewportWidth: document.documentElement.getBoundingClientRect().width, dpr: devicePixelRatio, scroll: document.body.scrollWidth, font: getComputedStyle(document.body).fontFamily, theme: document.documentElement.dataset.theme }))
        if (geometry.scroll > Math.ceil(geometry.viewportWidth)) {
          console.log('Overflow diagnostics', geometry, await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 0.1).slice(0,12).map(e => ({ tag: e.tagName, cls: e.className, right: e.getBoundingClientRect().right }))))
          await shot('overflow')
        }
        assert(geometry.scroll <= Math.ceil(geometry.viewportWidth), `Horizontal overflow on ${name}/${width}/${theme}`)
        assert(geometry.font.includes('Inter'), `Wrong typeface on ${name}`)
        if (name === 'welcome') assert(await page.getByRole('button', { name: 'Create my first workflow' }).isVisible())
        if (width === 1440 || width === 760) await shot(`${name}-${theme}-${width}`)
        layouts.push(`${name}/${theme}/${width}`)
      }
    }
  }
  await route('/settings/appearance')
  await page.locator('.settings-shell .appearance-selector button[value="system"]').click()
  await page.emulateMedia({ colorScheme: 'light' })
  await until(() => page.evaluate(() => document.documentElement.dataset.theme === 'light'), 'System light did not follow OS')
  await page.emulateMedia({ colorScheme: 'dark' })
  await until(() => page.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'System dark did not follow OS')
  await page.reload(); await page.waitForSelector('.settings-shell .appearance-selector')
  assert.equal(await page.evaluate(() => localStorage.getItem('ghost.appearance')), 'system')
  assert.deepEqual(errors, [], 'Renderer exceptions')
  await writeFile(join(profile, 'validation.json'), JSON.stringify({ layouts, graph: workflow, errors }, null, 2))
  console.log(`PASS ${process.env.GHOST_LAYOUT_ONLY ? "Layout-only" : "Blue + React Flow"}: preserved records/IDs/configs, selection/keyboard editing, node drag, handle connections/deletion, cycle rejection, reload persistence, zoom/minimap, clear results without graph loss, workspace search, independent card actions, ${layouts.length} theme/layout checks. Screenshots: ${screenshots}`)
} catch (error) {
  console.error(error)
  await shot('failure').catch(() => {})
  throw error
} finally {
  await Promise.race([app.close(), pause(1500).then(() => app.process().kill('SIGKILL'))])
  server.closeAllConnections(); server.close()
}
