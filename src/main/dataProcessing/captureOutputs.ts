import { getSavedWorkflow } from '../discoveryBackend'
import { captureSchema, valueSchema, type DataValue } from '../../shared/dataProcessing'
export async function captureBrowserOutputs(contents:Electron.WebContents,workflowId:string,nodeId:string):Promise<Record<string,DataValue>>{
 if(!/^[0-9a-f-]{36}$/i.test(workflowId))return {}
 const saved=await getSavedWorkflow(workflowId)
 if(!saved.ok)return {} // Downloads remain verified; configured extracted outputs stay unavailable offline.
 const node=saved.workflow.nodes.find(n=>n.id===nodeId),capture=captureSchema.parse(node?.config.outputCapture??{})
 if(!Object.values(capture).some(Boolean))return {}
 // Fixed extraction code with validated selector strings; never execute node/model-supplied JavaScript.
 const result=await contents.executeJavaScript(`(settings=>{
  const outputs={};const find=selector=>{const element=document.querySelector(selector);if(!element)throw Error('Configured output element was not found');return element};
  if(settings.textSelector){const text=find(settings.textSelector).textContent||'';if(text.length>1000000)throw Error('Text output exceeds limit');outputs.text={type:'text',value:text}}
  if(settings.jsonSelector){const text=find(settings.jsonSelector).textContent||'';if(text.length>1000000)throw Error('JSON output exceeds limit');outputs.json={type:'json',value:JSON.parse(text)}}
  if(settings.tableSelector){const table=find(settings.tableSelector);const records=Array.from(table.querySelectorAll('tr'));if(records.length>10001)throw Error('Table exceeds 10000 rows');const headers=Array.from(records.shift()?.querySelectorAll('th,td')||[]).map(e=>e.textContent.trim());if(!headers.length||headers.length>100||new Set(headers).size!==headers.length||headers.some(h=>!h||['__proto__','constructor','prototype'].includes(h)))throw Error('Invalid table headers');outputs.table={type:'rows',value:records.map(row=>{const cells=Array.from(row.querySelectorAll('td,th'));if(cells.length!==headers.length)throw Error('Table width mismatch');return Object.fromEntries(headers.map((h,i)=>[h,cells[i].textContent.trim()]))})}}
  return outputs
 })(${JSON.stringify(capture)})`,true) as Record<string,DataValue>
 for(const value of Object.values(result))valueSchema.parse(value)
 return result
}
