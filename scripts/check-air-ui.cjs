// Run after npm run build: node_modules/.bin/electron scripts/check-air-ui.cjs
// Exercises local UI flows without backend data or external recording actions.
const { app, BrowserWindow, nativeTheme } = require('electron');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');

app.setPath('userData', mkdtempSync(join(tmpdir(), 'ghost-air-ui-')));
let win;
const errors = [];
const watchdog = setTimeout(() => { console.error('FAIL UI check timed out'); app.exit(1); }, 30000);
const evaluate = expression => win.webContents.executeJavaScript(expression);
async function until(expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw Error(`UI condition did not resolve: ${expression}`);
}
async function click(selector) {
  await until(`!!document.querySelector(${JSON.stringify(selector)})`);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
}
app.whenReady().then(async () => {
  win = new BrowserWindow({ width: 1440, height: 960, show: false, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.on('console-message', (_event, _level, message) => {
    if (/Uncaught|Error boundary|Minified React error/.test(message)) errors.push(message);
  });
  nativeTheme.themeSource = 'light';
  await win.loadFile(join(__dirname, '../out/renderer/index.html'));
  await until(`document.fonts.status === 'loaded' && !!document.querySelector('#welcome-title')`);
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'light');
  await click('.appearance-selector button[value="dark"]');
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).colorScheme`), 'dark');
  await win.webContents.reload();
  await until(`!!document.querySelector('.appearance-selector')`);
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark', 'Explicit theme must survive reload');
  await click('.appearance-selector button[value="light"]');
  nativeTheme.themeSource = 'dark';
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'light', 'Explicit choice must ignore system changes');
  await click('.appearance-selector button[value="system"]');
  await until(`document.documentElement.dataset.theme === 'dark'`);
  nativeTheme.themeSource = 'light';
  await until(`document.documentElement.dataset.theme === 'light'`);
  assert.equal(await evaluate(`document.querySelector('.appearance-selector button[value="system"]').getAttribute('aria-pressed')`), 'true');
  assert.match(await evaluate(`getComputedStyle(document.body).fontFamily`), /Inter Variable/);
  assert.doesNotMatch(await evaluate(`getComputedStyle(document.body).fontFamily`), /Geist/);
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('root')).padding`), '0px');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.window-shell')).borderTopWidth`), '0px');
  await click('.actions .button--secondary');
  await until(`!!document.querySelector('dialog[open]')`);
  await click('dialog[open] .dialog-close');
  await click('.actions .button--primary');
  await until(`!!document.querySelector('.discovery-composer')`);
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).colorScheme`), 'light');
  await click('[aria-label="Create workflow draft"]');
  await until(`!!document.querySelector('dialog[open] input[name="name"]')`);
  await evaluate(`(() => {
    const form = document.querySelector('dialog[open] form');
    form.elements.namedItem('name').value = 'UI session draft';
    form.elements.namedItem('description').value = 'A local draft remains editable after navigation.';
    form.requestSubmit();
  })()`);
  await until(`document.querySelector('.editor-title-row h1')?.textContent.includes('UI session draft')`);
  const draftRoute = await evaluate('location.hash');
  assert.match(draftRoute, /^#\/workflows\/[0-9a-f-]{36}$/);
  await evaluate(`location.hash = '/dashboard'`);
  await until(`!!document.querySelector('.discovery-composer')`);
  await evaluate(`location.hash = ${JSON.stringify(draftRoute.slice(1))}`);
  await until(`document.querySelector('.editor-title-row h1')?.textContent.includes('UI session draft')`);
  assert.ok(await evaluate(`document.body.textContent.includes('A local draft remains editable after navigation.')`));
  await evaluate(`location.hash = '/dashboard'`);
  await until(`!!document.querySelector('.home-start-cards')`);
  await click('.home-card-lilac');
  await click('dialog[open] .template-list button');
  await until(`!!document.querySelector('.workflow-canvas') && document.querySelectorAll('.canvas-node').length > 1`);
  await click('.canvas-node:not(.trigger-node)');
  await until(`!!document.querySelector('dialog[open] [aria-label="Node inspector"]')`);
  await click('dialog[open] .dialog-close');
  for (const [width, height] of [[1440, 960], [1280, 800], [1024, 768]]) {
    win.setContentSize(width, height);
    for (const route of ['/dashboard', '/workflows', '/workflows/orders', '/workflows/orders/record/slack', '/settings', '/settings/appearance', '/settings/workspace']) {
      await evaluate(`location.hash = ${JSON.stringify(route)}`);
      await until(`document.readyState === 'complete'`);
      await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
      assert.equal(await evaluate(`document.documentElement.scrollWidth > innerWidth`), false, `${route} overflows at ${width}`);
      const frame = await evaluate(`(() => { const shell = document.getElementById('root').firstElementChild; const s = getComputedStyle(shell); const r = shell.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, border: s.borderTopWidth, radius: s.borderRadius, shadow: s.boxShadow }; })()`);
      const viewport = await evaluate(`({ width: innerWidth, height: innerHeight })`);
      assert.deepEqual(frame, { x: 0, y: 0, ...viewport, border: '0px', radius: '0px', shadow: 'none' }, `${route} adds an inset window frame at ${width}`);
      const hiddenActions = await evaluate(`Array.from(document.querySelectorAll('.record-events > nav button')).some(button => !button.getClientRects().length)`);
      assert.equal(hiddenActions, false, `Recorder diagnostics hidden at ${width}`);
    }
  }
  assert.deepEqual(errors, []);
  await evaluate(`location.hash = '/dashboard'`);
  await until(`!!document.querySelector('.discovery-composer')`);
  await evaluate(`(() => { const input = document.querySelector('#home-workflow-prompt'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'Keep this routine while changing appearance.'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await click('[aria-label="Settings"]');
  await until(`!!document.querySelector('.settings-shell') && location.hash.startsWith('#/settings')`);
  await click('a[href="#/settings/appearance"]');
  await click('.settings-shell .appearance-selector button[value="dark"]');
  await click('[aria-label="Back to app"]');
  await until(`!document.querySelector('.settings-shell') && location.hash === '#/dashboard'`);
  assert.equal(await evaluate(`document.querySelector('#home-workflow-prompt').value`), 'Keep this routine while changing appearance.', 'Full-page Settings must preserve the Home prompt');
  await evaluate(`location.hash = '/workflows/orders'`);
  await until(`!!document.querySelector('.workflow-canvas')`);
  const editorTitle = await evaluate(`document.querySelector('.editor-title-row h1').textContent`);
  const nodeCount = await evaluate(`document.querySelectorAll('.canvas-node').length`);
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).colorScheme`), 'dark');
  await click('[aria-label="Settings"]');
  await until(`!!document.querySelector('.settings-shell')`);
  await click('a[href="#/settings/appearance"]');
  assert.equal(await evaluate(`document.querySelector('.settings-shell .appearance-selector button[value="dark"]').getAttribute('aria-pressed')`), 'true');
  await click('.settings-shell .appearance-selector button[value="light"]');
  await click('[aria-label="Back to app"]');
  await until(`!document.querySelector('.settings-shell') && location.hash === '#/workflows/orders'`);
  assert.equal(await evaluate(`document.querySelector('.editor-title-row h1').textContent`), editorTitle);
  assert.equal(await evaluate(`document.querySelectorAll('.canvas-node').length`), nodeCount);
  assert.deepEqual(errors, []);
  console.log('PASS UI: welcome/dialogs, local draft editor and retention, templates, node inspector, Light/Dark/System persistence and live system changes, full-page Settings and origin state retention, bundled Inter typography, frameless full-bleed routes, light theme, responsive routes and accessible recorder tabs');
  clearTimeout(watchdog);
  win.destroy();
  app.exit(0);
}).catch(error => { console.error(error); clearTimeout(watchdog); win?.destroy(); app.exit(1); });
