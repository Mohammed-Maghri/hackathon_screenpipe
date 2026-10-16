import { build } from 'esbuild'
import { mkdir, unlink } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
const output = 'node_modules/.cache/ghost-processing-tests.mjs'
await mkdir('node_modules/.cache', { recursive: true })
await build({ entryPoints: ['scripts/processing-tests.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external' })
try { const result = spawnSync(process.execPath, [output], { stdio: 'inherit' }); process.exitCode = result.status ?? 1 } finally { await unlink(output) }
