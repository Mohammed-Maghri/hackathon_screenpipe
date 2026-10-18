// Dedicated local demo profile. Each recording posts its own Slack report unless --draft-only is passed.
import { _electron } from 'playwright-core'
import electronPath from 'electron'
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const sendSlack = !args.includes('--draft-only')
const reuseSlack = args.includes('--reuse-slack')
const outputArg = args.find(arg => !arg.startsWith('--'))
const output = resolve(outputArg || join(homedir(), 'Documents', 'Ghost-demo-video', new Date().toISOString().replaceAll(':', '-')))
const raw = join(output, 'raw')
const scriptDir = dirname(fileURLToPath(import.meta.url))
const cursorHelper = join(raw, 'natural-cursor')
const openScreen = '/Applications/Openscreen.app/Contents/MacOS/Openscreen'
const screenProject = join(output, 'Ghost-demo.openscreen')
const screenVideo = join(output, 'Ghost-demo.mp4')
const textFinder = join(raw, 'find-screen-text')
const scrollPoint = { x: 1180, y: 680 }
await mkdir(raw, { recursive: true })
execFileSync('swiftc', [join(scriptDir, 'natural-cursor.swift'), '-O', '-o', cursorHelper])
execFileSync('swiftc', [join(scriptDir, 'find-screen-text.swift'), '-O', '-o', textFinder])
const scenes = []
const started = Date.now()
let app
let page
let windowHandle
let workflowId
let screenRecorder
async function startScreenRecorder() {
  execFileSync('osascript', [
    '-e', 'tell application "Finder" to activate',
    '-e', 'tell application "Finder" to close every window',
    '-e', 'delay 0.4',
    '-e', 'tell application "System Events" to keystroke "h" using {command down, option down}',
    '-e', 'delay 0.6',
  ])
  await new Promise((resolve, reject) => {
    const child = spawn(openScreen, ['record', '--display', '0', '--cursor', 'system', '--project', screenProject, '--json'], { stdio: ['pipe', 'pipe', 'inherit'] })
    let output = ''
    let ready = false
    const timer = setTimeout(() => {
      child.kill('SIGINT')
      reject(Error('OpenScreen did not start recording within 30 seconds.'))
    }, 30000)
    child.stdout.on('data', chunk => {
      output += chunk.toString()
      if (output.includes('Recording started')) {
        ready = true
        clearTimeout(timer)
        screenRecorder = child
        resolve()
      }
    })
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('exit', code => {
      if (!ready) { clearTimeout(timer); reject(Error(`OpenScreen exited before recording started (${code}). ${output}`)) }
    })
  })
}
async function stopScreenRecorder() {
  if (!screenRecorder) return
  const child = screenRecorder
  screenRecorder = undefined
  if (child.exitCode !== null) {
    if (child.exitCode !== 0) throw Error(`OpenScreen exited with code ${child.exitCode}.`)
    return
  }
  const stopped = new Promise((resolve, reject) => {
    child.once('exit', code => code === 0 ? resolve() : reject(Error(`OpenScreen exited with code ${code}.`)))
  })
  child.stdin.write('stop' + String.fromCharCode(10))
  await stopped
}
async function exportScreenRecording() {
  const project = JSON.parse(await readFile(screenProject, 'utf8'))
  Object.assign(project.editor, { wallpaper: null, wallpaperMotion: 'none', shadowIntensity: 0, backgroundBlur: 0, motionBlurAmount: 0.18, depthOfField: false, borderRadius: 0, padding: 0, autoZoomEnabled: false, aspectRatio: 'auto' })
  await writeFile(screenProject, JSON.stringify(project, null, 2) + '\n')
  execFileSync(openScreen, ['export', screenProject, '--out', screenVideo, '--quality', 'source', '--fps', '60', '--json'], { stdio: 'ignore' })
}
async function moveTo(locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) throw Error('Cannot point to an off-screen control.')
  const bounds = await windowHandle.evaluate(window => window.getContentBounds())
  const x = Math.round(bounds.x + box.x + box.width / 2)
  const y = Math.round(bounds.y + box.y + box.height / 2)
  execFileSync(cursorHelper, [String(x), String(y)])
  await page.waitForTimeout(180)
}
async function click(locator) {
  await moveTo(locator)
  await locator.click({ timeout: 10000 })
  await page.waitForTimeout(250)
}
async function scrollNaturallyTo(locator) {
  const scrollArea = page.locator('.nova-result-content')
  const area = await scrollArea.boundingBox()
  if (!area) throw Error('The Results report scroll area is not visible.')
  const viewportHeight = await page.evaluate(() => innerHeight)
  const mouseX = area.x + area.width / 2
  const mouseY = area.y + area.height / 2
  await page.mouse.move(mouseX, mouseY)
  const screenBounds = await windowHandle.evaluate(window => window.getContentBounds())
  execFileSync(cursorHelper, [String(Math.round(screenBounds.x + mouseX)), String(Math.round(screenBounds.y + mouseY))])
  for (let step = 0; step < 30; step++) {
    const target = await locator.boundingBox()
    if (!target) throw Error('The budget control disappeared while scrolling.')
    const clipTop = Math.max(8, area.y)
    const clipBottom = Math.min(viewportHeight - 8, area.y + area.height)
    if (target.y >= clipTop + 8 && target.y + target.height <= clipBottom - 8) {
      await moveTo(locator)
      return
    }
    const before = await scrollArea.evaluate(element => element.scrollTop)
    const delta = target.y + target.height > clipBottom - 8 ? 210 : -210
    await page.mouse.wheel(0, delta)
    await page.waitForTimeout(360 + Math.floor(Math.random() * 130))
    const after = await scrollArea.evaluate(element => element.scrollTop)
    if (after === before && step === 3) throw Error(`Mouse wheel did not move the Results report (scrollTop ${before}).`)
  }
  throw Error('Could not naturally scroll the control into view.')
}
async function scene(name, hold = 2000) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(output, name + '.png') })
  scenes.push({ name, seconds: (Date.now() - started) / 1000 })
  await writeFile(join(output, 'scenes.json'), JSON.stringify(scenes, null, 2))
  console.log('Captured:', name)
  await page.waitForTimeout(hold)
}
async function waitForVisibleText(text, timeout = 12000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const point = execFileSync(textFinder, [text], { encoding: 'utf8' }).trim().split(/\s+/).map(Number)
      if (point.length === 2 && point.every(Number.isFinite)) return point
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw Error(`Could not find visible screen text: ${text}`)
}
try {
  const appEnv = { ...process.env, ELECTRON_RENDERER_URL: '', GHOST_DEMO_FAST_CINEMATIC: '1' }
  if (sendSlack) {
    delete appEnv.GHOST_SLACK_DELIVERY
    appEnv.GHOST_DEMO_NOTIFICATION_DELAY_MS = '18000'
    appEnv.GHOST_DEMO_APP_TOAST = '1'
  } else {
    appEnv.GHOST_SLACK_DELIVERY = 'draft'
    if (reuseSlack) {
      appEnv.GHOST_DEMO_REUSE_SLACK_NOTIFICATION = '1'
      appEnv.GHOST_DEMO_NOTIFICATION_DELAY_MS = '18000'
      appEnv.GHOST_DEMO_APP_TOAST = '1'
    }
  }
  await startScreenRecorder()
  scenes.push({ name: '01-desktop', seconds: 0 })
  await new Promise(resolve => setTimeout(resolve, 3200))
  app = await _electron.launch({
    executablePath: electronPath,
    args: [`--user-data-dir=${join(output, 'profile')}`, '.'],
    env: appEnv,
    recordVideo: { dir: join(output, 'raw'), size: { width: 1800, height: 1125 } },
    timeout: 30000,
  })
  page = await app.firstWindow()
  windowHandle = await app.browserWindow(page)
  await windowHandle.evaluate(window => window.setBounds({ x: 150, y: 80, width: 1500, height: 950 }))
  await page.waitForTimeout(800)
  console.log('Desktop-window capture viewport:', await page.evaluate(() => `${innerWidth} × ${innerHeight}`))
  await page.waitForFunction(() => !!window.ghost?.nova)
  await scene('02-ghost-intro', 1600)
  await click(page.getByRole('button', { name: 'Open workspace', exact: true }))
  const input = page.getByRole('textbox', { name: 'Describe the process to automate' })
  await input.waitFor()
  await scene('03-home', 500)
  // Get to the product quickly; use the visible NOVA shortcut as the request.
  await click(page.getByRole('button', { name: 'NOVA · Restock products', exact: true }))
  await input.waitFor({ state: 'visible' })
  await scene('04-nova-entrypoint', 700)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await click(page.getByRole('button', { name: 'Find my workflow', exact: true }))
  await page.waitForURL(/workflows\//, { timeout: 30000 })
  workflowId = page.url().split('/workflows/')[1]?.split('?')[0]
  const cinematicReveal = page.getByTestId('workflow-generation')
  await cinematicReveal.waitFor({ state: 'visible', timeout: 15000 })
  await cinematicReveal.waitFor({ state: 'hidden', timeout: 90000 })
  await page.getByRole('button', { name: 'Run workflow', exact: true }).waitFor()
  await page.waitForTimeout(400)
  await scene('05-workflow', 2200)
  await click(page.getByRole('button', { name: 'Run workflow', exact: true }))
  await click(page.getByRole('button', { name: 'Start complete workflow', exact: true }))
  await scene('06-run-start', 500)
  const deadline = Date.now() + 180000
  let run
  while (Date.now() < deadline) {
    const data = await page.evaluate(() => window.ghost.nova.list())
    run = data.runs.find(r => r.workflowId === workflowId)
    if (run && run.state !== 'running') break
    await page.waitForTimeout(500)
  }
  if (!run || run.state !== 'needs_review') throw Error(run?.error || 'Workflow did not reach human review.')
  if (sendSlack && run.delivery?.state !== 'sent') throw Error('Slack delivery was not confirmed; no notification scene can be recorded.')
  if (!sendSlack && run.delivery?.state === 'sent') throw Error('Unexpected outbound delivery in draft-only recording.')
  await writeFile(join(output, 'verified-run.json'), JSON.stringify(run, null, 2))
  await scene('07-run-complete', 400)
  await page.evaluate(id => { location.hash = '/results?workflow=' + id }, workflowId)
  await click(page.getByRole('button', { name: 'Report & files', exact: true }))
  await scene('08-results-report', 700)
  const adjust = page.getByText('Adjust the buying list', { exact: true })
  await scrollNaturallyTo(adjust)
  await click(adjust)
  const budget = page.getByRole('spinbutton', { name: 'Buying budget', exact: true })
  await budget.waitFor({ state: 'visible' })
  await scrollNaturallyTo(budget)
  await click(budget)
  await budget.fill('')
  await budget.pressSequentially('300', { delay: 170 })
  await scene('09-budget-300', 900)
  const saveProposal = page.getByRole('button', { name: 'Save proposal and Excel', exact: true })
  await scrollNaturallyTo(saveProposal)
  await click(saveProposal)
  await page.getByText(/Proposal 1 ·/).waitFor({ timeout: 15000 })
  await scene('10-proposal-saved', 900)
  // Show the team workspace after the report, then return to results for the finish.
  await click(page.getByRole('link', { name: 'Team', exact: true }))
  await page.waitForURL(/\/team$/)
  await scene('11-team-people-and-departments', 1100)
  for (const section of ['Workflows', 'Requests', 'Activity']) {
    await click(page.getByRole('button', { name: section, exact: true }))
    await scene(`12-team-${section.toLowerCase()}`, 1100)
  }
  await click(page.getByRole('button', { name: 'People & departments', exact: true }))
  await click(page.getByRole('link', { name: 'Results', exact: true }))
  await page.waitForURL(/\/results/)
  await scene('13-back-to-results', 350)
  if (sendSlack || reuseSlack) {
    const notification = page.getByRole('button', { name: 'Open Slack', exact: true })
    await notification.waitFor({ state: 'visible', timeout: 30000 })
    await click(notification)
    await waitForVisibleText('#daily-reports')
    scenes.push({ name: '14-notification-click-opens-slack', seconds: (Date.now() - started) / 1000 })
    execFileSync(cursorHelper, [String(scrollPoint.x), String(scrollPoint.y)])
    execFileSync(cursorHelper, [String(scrollPoint.x), String(scrollPoint.y), '--scroll', '-38'])
    await new Promise(resolve => setTimeout(resolve, 850))
    scenes.push({ name: '15-slack-report-top', seconds: (Date.now() - started) / 1000 })
    for (let index = 0; index < 4; index++) {
      execFileSync(cursorHelper, [String(scrollPoint.x), String(scrollPoint.y), '--scroll', '9'])
      await new Promise(resolve => setTimeout(resolve, 1350))
      scenes.push({ name: `16-slack-report-scroll-${index + 1}`, seconds: (Date.now() - started) / 1000 })
    }
    await new Promise(resolve => setTimeout(resolve, 1500))
    await app.close()
    app = null
    await stopScreenRecorder()
    await exportScreenRecording()
  } else {
    await app.close()
    app = null
    await stopScreenRecorder()
    await exportScreenRecording()
    execFileSync('open', ['-a', 'Slack'])
    await new Promise(resolve => setTimeout(resolve, 5000))
    scenes.push({ name: '13-existing-slack-report', seconds: (Date.now() - started) / 1000 })
  }
  await writeFile(join(output, 'scenes.json'), JSON.stringify(scenes, null, 2))
  const ending = sendSlack ? 'A fresh NOVA report was posted through Screenpipe for this run. The Ghost notification opens native Slack; cursor scrolls through the report. No purchase orders placed.' : reuseSlack ? 'Slack delivery stayed draft-only. A delayed notification opened the previously verified NOVA report in Slack; no duplicate message sent.' : 'Slack delivery is disabled. Existing Slack window shown read-only; no message sent.'
  await writeFile(join(output, 'README.txt'), `Continuous full-desktop OpenScreen capture. Ghost window is centered at 1500 × 950, leaving desktop visible. Intro and cinematic node reveal play normally. ${ending} Ghost-demo.mp4 is the exported video and Ghost-demo.openscreen is its editable project. Raw page videos and helper binaries are in raw/. Scene timestamps are in scenes.json. Dedicated profile is in profile/. Do not publish profile/; it can contain browser sessions.\n`)
  console.log(`PASS: ${ending}\nOutput:`, output)
} catch (error) {
  await writeFile(join(output, 'failure.txt'), String(error))
  if (page) await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {})
  throw error
} finally {
  await stopScreenRecorder().catch(error => console.error('OpenScreen stop failed:', error))
  if (app) await app.close()
}
