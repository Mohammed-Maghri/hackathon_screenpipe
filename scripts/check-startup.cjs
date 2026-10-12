// Run after building: node_modules/.bin/electron scripts/check-startup.cjs
// Uses the default display backend; optionally pass --ozone-platform=x11.
const { app, BrowserWindow } = require('electron');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
app.setPath('userData', mkdtempSync(join(tmpdir(), 'ghost-startup-')));
const timeout = setTimeout(() => { console.error('FAIL: startup timed out'); app.exit(1); }, 15000);
app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', () => {
    setImmediate(async () => {
      try {
        if (!window.isVisible()) throw new Error('Loaded window remains hidden');
        const content = await window.webContents.executeJavaScript('document.body.innerText');
        if (!content.includes('GHOST')) throw new Error('Ghost UI did not render');
        const frame = await window.webContents.capturePage();
        if (frame.isEmpty()) throw new Error('No rendered frame');
        console.log('PASS: default startup loads, shows window and captures a rendered frame');
        clearTimeout(timeout);
        app.exit(0);
      } catch (error) { console.error(error); app.exit(1); }
    });
  });
});
import(pathToFileURL(join(__dirname, '../out/main/index.js')).href).catch(error => {
  console.error(error); app.exit(1);
});
