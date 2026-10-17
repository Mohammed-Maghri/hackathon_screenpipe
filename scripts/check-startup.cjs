// Run after building: node_modules/.bin/electron scripts/check-startup.cjs
// Uses the default display backend; optionally pass --ozone-platform=x11.
const { app, BrowserWindow, nativeTheme } = require('electron');
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
        if (!content.toLowerCase().includes('ghost')) throw new Error('Ghost UI did not render');
        const nativeSource = nativeTheme.themeSource;
        await window.webContents.executeJavaScript(`window.ghost.setAppearance('dark')`);
        if (window.getBackgroundColor().toLowerCase() !== '#0a0a0a') throw new Error('Dark window backing color not applied: ' + window.getBackgroundColor());
        if (nativeTheme.themeSource !== nativeSource) throw new Error('App appearance changed guest website/system theme');
        const rejected = await window.webContents.executeJavaScript(`window.ghost.setAppearance('invalid').then(() => false, () => true)`);
        if (!rejected) throw new Error('Invalid appearance must be rejected');
        await window.webContents.executeJavaScript(`window.ghost.setAppearance('light')`);
        if (window.getBackgroundColor().toLowerCase() !== '#f6f6f3') throw new Error('Light window backing color not applied: ' + window.getBackgroundColor());
        const frame = await window.webContents.capturePage();
        if (frame.isEmpty()) throw new Error('No rendered frame');
        console.log('PASS: default startup renders; validated appearance IPC updates window backing without changing guest website theme');
        clearTimeout(timeout);
        app.exit(0);
      } catch (error) { console.error(error); app.exit(1); }
    });
  });
});
import(pathToFileURL(join(__dirname, '../out/main/index.js')).href).catch(error => {
  console.error(error); app.exit(1);
});
