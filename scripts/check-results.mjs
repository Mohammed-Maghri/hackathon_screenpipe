import {build} from 'esbuild';
const bundled=await build({entryPoints:['scripts/results-tests.ts'],bundle:true,write:false,platform:'node',format:'esm'});
await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
