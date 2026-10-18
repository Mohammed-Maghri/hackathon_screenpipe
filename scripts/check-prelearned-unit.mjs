import { build } from 'esbuild';
const result=await build({entryPoints:['scripts/prelearned-browser-tests.ts'],bundle:true,write:false,platform:'node',format:'esm'});
await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
