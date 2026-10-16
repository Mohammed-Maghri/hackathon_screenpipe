import { build } from 'esbuild'
import { unlink } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
const output='out/main/runtime-logic-tests.mjs'
await build({entryPoints:['scripts/runtime-logic-tests.ts'],outfile:output,bundle:true,platform:'node',format:'esm',packages:'external'})
try{const result=spawnSync(process.execPath,[output],{stdio:'inherit'});process.exitCode=result.status??1}finally{await unlink(output)}
