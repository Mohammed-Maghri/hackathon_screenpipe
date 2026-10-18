import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import electronPath from 'electron';
import {_electron} from 'playwright-core';
const profile=await mkdtemp(join(tmpdir(),'ghost-nova-pipeline-'));
const app=await _electron.launch({executablePath:electronPath,args:['.',`--user-data-dir=${profile}`,'--ozone-platform=x11']});
async function until(page,predicate,timeout=20000){const start=Date.now();while(Date.now()-start<timeout){const data=await page.evaluate(()=>window.ghost.nova.list());if(predicate(data))return data;await new Promise(r=>setTimeout(r,200))}throw Error('Timed out waiting for pipeline state')}
const timeout=setTimeout(()=>{console.error('Timed out');void app.close()},240000);
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>!!window.ghost?.nova);await page.evaluate(()=>location.hash='/results');
 const bundle=await build({entryPoints:['src/renderer/src/data/demoDiscovery.ts'],bundle:true,write:false,format:'esm'});
 const {demoWorkflow}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 const definition=demoWorkflow('nova','Check NOVA inventory and prepare a buying list');
 await page.evaluate(async definition=>{const workflow={...definition,id:crypto.randomUUID(),updatedAt:new Date().toISOString()};await window.ghost.browser.prepareHosted(workflow.id,workflow.nodes.filter(n=>n.config.stepType==='browser').map(n=>({id:n.id,url:n.config.startUrl})));await window.ghost.nova.configure(workflow);localStorage.setItem('ghost.prepared-workflows.v1',JSON.stringify([workflow]));location.hash='/results?workflow='+workflow.id},definition);
 await page.reload();
 await until(page,data=>data.workflows.length===1);
 const workflow=(await page.evaluate(()=>window.ghost.nova.list())).workflows[0];
 await page.evaluate(id=>location.hash='/workflows/'+id,workflow.id);
 await page.getByRole('button',{name:'Run workflow',exact:true}).click();
 await page.getByRole('button',{name:'Start complete workflow',exact:true}).click();
 await until(page,data=>data.runs[0]&&data.runs[0].state!=='running',190000);
 let data=await page.evaluate(()=>window.ghost.nova.list());console.log(JSON.stringify(data.runs[0],null,2));
 assert.equal(data.runs[0].state,'needs_review');assert.equal(data.runs[0].files.length,6);assert.equal(data.runs[0].nodes.filter(n=>n.state==='verified').length,5);
 await page.getByText('Adjust the buying list',{exact:true}).click();
 await page.getByLabel('Buying budget').fill('300');
 await page.getByLabel('Quantity for Oversized Hoodie – Black').fill('2');
 await page.getByRole('button',{name:'Save proposal and Excel',exact:true}).click();
 await until(page,data=>data.runs[0].scenarios?.length===1);
 let scenarioData=await page.evaluate(()=>window.ghost.nova.list());
 assert.equal(scenarioData.runs[0].scenarios[0].plan.rows.find(r=>r.id==='hoodie').quantity,2);
 assert.equal(scenarioData.runs[0].scenarios[0].files.length,3);
 await page.getByText(/Proposal 1 ·/).click();
 await page.getByRole('button',{name:'Approve this proposal',exact:true}).click();
 await until(page,data=>!!data.runs[0].scenarios?.[0].approvedAt);
 await page.getByRole('button',{name:'Approve this report'}).click();
 await until(page,data=>data.runs[0].state==='approved');
 await page.getByText('Scheduling and run options',{exact:true}).click();
 await page.getByRole('button',{name:'Schedule 3 test runs'}).click();
 await until(page,data=>data.schedules.length===3);
 // The actual production scheduler runs at +1,+2,+3 minutes. Use a separate scheduled test campaign to wait for them.
 if(process.env.GHOST_TEST_SCHEDULES==='1'){
  clearTimeout(timeout);
  await until(page,data=>data.schedules.every(s=>['done','failed'].includes(s.state)),300000);
  data=await page.evaluate(()=>window.ghost.nova.list());assert.ok(data.schedules.every(s=>s.state==='done'),JSON.stringify(data));assert.equal(data.runs.length,4);
 }else{for(const s of (await page.evaluate(()=>window.ghost.nova.list())).schedules)await page.evaluate(id=>window.ghost.nova.cancelSchedule(id),s.id)}
 await page.screenshot({path:join(profile,'nova-results.png'),fullPage:true});
 await page.setViewportSize({width:800,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 data=await page.evaluate(()=>window.ghost.nova.list());await writeFile(join(profile,'acceptance.json'),JSON.stringify(data,null,2));
 console.log('PASS: real hosted browser login/exports → local generated scripts → calculation → Excel/CSV/JSON/draft → approval. Profile: '+profile);
}finally{clearTimeout(timeout);await app.close()}
