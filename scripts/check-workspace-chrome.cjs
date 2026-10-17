// Run after npm run build. Uses an isolated native macOS window and temporary profile.
const { app } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

if (process.platform !== 'darwin') {
  console.log('SKIP native macOS chrome geometry on this platform');
  process.exit(0);
}
app.setPath('userData', mkdtempSync(join(tmpdir(), 'ghost-native-chrome-')));
process.env.GHOST_BACKEND_URL = 'http://127.0.0.1:9';
const timeout = setTimeout(() => { console.error('Native chrome check timed out'); app.exit(1); }, 30000);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

app.on('browser-window-created', (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  win.on('show', () => win.hide());
  win.webContents.once('did-finish-load', () => setImmediate(async () => {
    const evaluate = expression => win.webContents.executeJavaScript(expression);
    async function until(expression) {
      for (let attempt = 0; attempt < 120; attempt++) {
        if (await evaluate(expression)) return;
        await pause(25);
      }
      throw Error(`Condition did not resolve: ${expression}`);
    }
    try {
      await until('!!window.ghost && !!document.querySelector(".appearance-selector")');
      await evaluate('document.querySelector(\'.appearance-selector button[value="dark"]\').click()');
      const native = win.getWindowButtonPosition();
      assert.deepEqual(native, { x: 25, y: 22 });
      const routes = [
        ['/dashboard', '.topbar-context'],
        ['/workflows', '.workflows-page-title'],
        ['/workflows/orders', '.editor-breadcrumb>button'],
        ['/workflows/00000000-0000-4000-8000-000000000001', '.editor-not-found'],
      ];
      for (const [width, height] of [[1440, 960], [1024, 768], [760, 620]]) {
        win.setContentSize(width, height);
        for (const [route, selector] of routes) {
          await evaluate(`location.hash = ${JSON.stringify(route)}`);
          await until(`!!document.querySelector('.sidebar-toolbar') && !!document.querySelector(${JSON.stringify(selector)})`);
          for (const collapsed of [false, true]) {
            if (await evaluate('localStorage.getItem("ghost.sidebar.collapsed") === "true"') !== collapsed) {
              await evaluate('document.querySelector(".sidebar-toolbar button").click()');
            }
            await pause(100);
            const geometry = await evaluate(`(() => {
              const rect = element => {
                const r = element.getBoundingClientRect();
                return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width };
              };
              return {
                sidebar: rect(document.querySelector('[aria-label="Workflow sidebar"]')),
                toggle: rect(document.querySelector('.sidebar-toolbar button')),
                header: rect(document.querySelector(${JSON.stringify(selector)})),
                chrome: rect(document.querySelector('.workspace-titlebar')),
              };
            })()`);
            assert.equal(geometry.sidebar.width, collapsed || width < 1024 ? 56 : 240);
            assert.equal(geometry.sidebar.y, 56);
            assert.equal(geometry.chrome.x, 0);
            assert.equal(geometry.chrome.width, width);
            assert.equal(geometry.chrome.bottom, 56);
            assert(geometry.toggle.x >= 112);
            for (const rect of [geometry.toggle, geometry.header]) {
              const overlapsNative = rect.x < native.x + 80 && rect.right > native.x && rect.y < native.y + 18 && rect.bottom > native.y;
              assert(!overlapsNative, JSON.stringify({ route, geometry }));
            }
          }
        }
        const workspaceTitlebarHeight = await evaluate(`document.querySelector('.workspace-titlebar .titlebar').getBoundingClientRect().height`);
        for (const theme of ['light', 'dark']) {
          await evaluate(`location.hash = '/settings/appearance'`);
          await until(`!!document.querySelector('.settings-shell:not(.invisible) .appearance-selector')`);
          await evaluate(`document.querySelector('.settings-shell .appearance-selector button[value="${theme}"]').click()`);
          for (const section of ['general', 'appearance', 'workspace']) {
            await evaluate(`location.hash = '/settings/${section}'`);
            await pause(50);
            const settings = await evaluate(`(() => {
              const rect = selector => {
                const r = document.querySelector(selector).getBoundingClientRect();
                return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
              };
              return {
                bar: rect('.settings-windowbar'),
                titlebar: rect('.settings-windowbar .titlebar'),
                sidebar: rect('.settings-sidebar'),
                back: rect('.settings-sidebar [aria-label="Back to app"]'),
              };
            })()`);
            assert.deepEqual(settings.bar, { x: 0, y: 0, width, height: 56, bottom: 56 }, `Settings chrome differs from workspace: ${theme}/${section}/${width}`);
            assert.equal(settings.titlebar.height, workspaceTitlebarHeight);
            assert.equal(settings.sidebar.y, 56);
            assert.equal(settings.back.y, 56);
            assert(settings.bar.bottom > native.y + 18, 'Native buttons need lower clearance');
          }
        }
      }
      console.log('PASS native chrome: safe native controls, aligned expanded/compact rails and matching Settings titlebar in both themes across all sections at1440/1024/760');
      clearTimeout(timeout);
      app.exit(0);
    } catch (error) {
      console.error(error);
      clearTimeout(timeout);
      app.exit(1);
    }
  }));
});
import(pathToFileURL(join(__dirname, '../out/main/index.js')).href).catch(error => { console.error(error); app.exit(1); });
