import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readdir,cp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import electronPath from 'electron';
import {_electron} from 'playwright-core';
const profile=await mkdtemp(join(tmpdir(),'ghost-results-ui-'));
const source=process.env.GHOST_RESULTS_SOURCE;
if(!source)throw Error('Set GHOST_RESULTS_SOURCE to an isolated profile with real verified replay reports.');
const app=await _electron.launch({executablePath:electronPath,args:['.',`--user-data-dir=${profile}`,'--ozone-platform=x11']});
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>!!window.ghost?.results);
 await page.evaluate(()=>location.hash='/results');
 await page.getByText('No browser runs yet').waitFor();
 for(const dir of await readdir(join(source,'recordings'),{withFileTypes:true})){
  if(!dir.isDirectory()||! /^[a-f0-9-]{36}$/.test(dir.name))continue;
  const dest=join(profile,'recordings',dir.name);await mkdir(dest,{recursive:true});
  for(const file of ['session.json','runs','downloads'])try{await cp(join(source,'recordings',dir.name,file),join(dest,file),{recursive:true})}catch(error){if(error.code!=='ENOENT')throw error}
  for(const file of await readdir(join(dest,'runs')).catch(()=>[])){
    const path=join(dest,'runs',file),report=JSON.parse(await readFile(path,'utf8'));
    for(const artifact of report.artifacts??[])artifact.path=join(dest,'downloads',artifact.id);
    await writeFile(path,JSON.stringify(report));
  }
 }
 const ids=await page.evaluate(async()=>[...new Set((await window.ghost.results.list()).runs.map(r=>r.workflowId))]);
 await page.evaluate(ids=>{const rows=ids.map((id,i)=>({id,name:'Workflow '+(i+1),nodes:[],edges:[],updatedAt:new Date().toISOString(),status:'DRAFT'}));rows.push({id:crypto.randomUUID(),name:'Empty workflow',nodes:[],edges:[],updatedAt:new Date().toISOString(),status:'DRAFT'});localStorage.setItem('ghost.prepared-workflows.v1',JSON.stringify(rows))},ids);
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await page.locator('#results-workflow option[value="'+ids[0]+'"]').waitFor({state:'attached'});
 await page.locator('#results-workflow').selectOption(ids[0]);
 await page.locator('.results-history-list button').first().waitFor();
 await page.waitForFunction(()=>document.querySelector('.results-card tbody tr'));
 assert.ok(await page.locator('.results-history-list button').count()>=2);
 assert.ok(await page.locator('.results-baseline').count()===1);
 assert.equal(await page.getByRole('link',{name:'Results',exact:true}).getAttribute('aria-current'),'page');
 await page.screenshot({path:join(profile,'results-desktop.png'),fullPage:true});
 await page.evaluate(()=>{localStorage.setItem('ghost.appearance','dark');window.dispatchEvent(new StorageEvent('storage',{key:'ghost.appearance'}))});
 await page.screenshot({path:join(profile,'results-dark.png'),fullPage:true});
 await page.setViewportSize({width:800,height:900});
 await page.screenshot({path:join(profile,'results-compact.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('.results-history-list button').last().click();
 await page.getByText('Baseline saved. Run this browser task again to compare inventory.').waitFor();
 await page.locator('#results-workflow').selectOption({label:'Empty workflow'});
 await page.getByText('No browser runs yet').waitFor();
 assert.equal(await page.locator('.results-history-list button').count(),0);
 assert.equal(await page.locator('.nova-panel').count(),0);
 await page.reload();await page.getByText('No browser runs yet').waitFor();
 assert.equal(await page.locator('#results-workflow option:checked').innerText(),'Empty workflow');
 console.log('PASS: workflow isolation, URL persistence, no unrelated NOVA tools; empty state, real replay history, comparison, baseline, navigation, compact layout. Screenshots: '+profile);
}finally{await app.close()}
