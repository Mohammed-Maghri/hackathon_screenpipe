import {build} from 'esbuild';
import {writeFile,unlink} from 'node:fs/promises';
const path=new URL('./.nova-logic-tests.mjs',import.meta.url);
try{const result=await build({entryPoints:['scripts/nova-logic-tests.ts'],bundle:true,write:false,platform:'node',format:'esm',packages:'external'});await writeFile(path,result.outputFiles[0].text);await import(path.href)}finally{await unlink(path).catch(()=>{})}
