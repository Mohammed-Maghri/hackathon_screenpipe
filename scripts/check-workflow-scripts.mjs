import { build } from 'esbuild'
import { writeFile, unlink } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const path=new URL('./.workflow-script-tests.mjs',import.meta.url)
try {
 const result=await build({entryPoints:['scripts/workflow-script-tests.ts'],bundle:true,write:false,platform:'node',format:'esm',packages:'external'})
 await writeFile(path,result.outputFiles[0].text)
 await import(pathToFileURL(path.pathname).href)
}finally{await unlink(path).catch(()=>{})}
