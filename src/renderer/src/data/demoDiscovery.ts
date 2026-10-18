import type { WorkflowCreate } from '../../../shared/discovery'
export type DemoScenario = 'nova' | 'forma'
export const workflowPrompts = {
 nova: 'Check my sales and inventory in NOVA and prepare next week’s shopping list. Flag urgent products, estimate the cost, and prepare a Slack update for my approval.',
 forma: 'Review my payments and overdue invoices in Forma, prepare a finance report, and draft a Slack update for my approval.',
} satisfies Record<DemoScenario, string>
const words: Record<DemoScenario,string[]> = {
 nova: ['nova','sales','stock','inventory','restock','restocking','reorder','shopping','supplier','products'],
 forma: ['forma','invoice','invoices','payment','payments','overdue','finance','receivable'],
}
function near(a:string,b:string) {
 if(a===b)return true
 if(a.length<5||b.length<5||Math.abs(a.length-b.length)>1)return false
 let previous=Array.from({length:b.length+1},(_,i)=>i)
 for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,previous[j+1]+1,previous[j]+(a[i]===b[j]?0:1)));previous=next}
 return previous[b.length]<=1
}
export function matchDemo(prompt:string):DemoScenario|null {
 const tokens=prompt.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,' ').split(/\s+/)
 const matches=(Object.keys(words) as DemoScenario[]).filter(key=>tokens.some(token=>words[key].some(word=>near(token,word))))
 return matches.length===1?matches[0]:null
}
export function demoWorkflow(scenario:DemoScenario,prompt:string):WorkflowCreate {
 const nova=scenario==='nova'
 const steps=[
  {label:nova?'Find the recorded restocking request':'Find the recorded finance-review request',app:'Screenpipe',kind:'application',description:'Prepared Screenpipe-style context for this demo. In the live flow, Screenpipe can search recorded activity for the request and routine. No history was searched and no observations are claimed.',instructions:['Review the original request: '+prompt,'Demo context only; there are no evidence IDs.']},
  {label:nova?'Download NOVA sales, inventory & reference Excel':'Download Forma finance report',app:'Chrome',kind:'browser',description:nova?'One recorded browser task downloads sales, inventory and the NOVA-calculated reference shopping list.':'One recorded browser task reviews payment statuses and downloads the finance CSV.',instructions:nova?['The pre-taught task signs in to the public NOVA demo and navigates to Restocking.','Download sales CSV, inventory CSV, and Excel for approval.','Do not record loading demo stock: replay should use the latest saved stock.']:['The pre-taught task signs in to the public Forma demo and navigates to Finance.','Review the payment dashboard and export its finance CSV.'],url:nova?'https://hackathon-screenpipe.vercel.app/nova/restocking':'https://hackathon-screenpipe.vercel.app/finance'},
  {label:nova?'Review NOVA restocking calculations':'Review payment totals and overdue invoices',app:'Excel',kind:'application',description:nova?'NOVA calculates sales rate, target stock, eligible incoming units, purchase quantity and cost. Ghost-side restocking arithmetic is not implemented.':'Review the exported payment amounts and statuses. This prepared node does not execute a finance calculation.',instructions:['Inspect the downloaded report; do not use preset totals as run results.','Confirm source files are from the current run.']},
  {label:'Approve the report',app:'Excel',kind:'review',description:'Human review is required before sharing. This draft does not connect approval to an automatic delivery runner.',instructions:['Check quantities, totals and warnings.','Approve the intended summary and destination before sending.']},
  {label:'Preview a Slack update',app:'Slack',kind:'integration',description:'Demo message preview only. No Slack connection or outbound send is configured.',instructions:[nova?'NOVA restocking review: [product count] products; [recommended cost]; [urgent items]; [budget warning].':'Forma finance review: [paid total]; [overdue invoices]; [report reference].','Replace placeholders with verified values from this run.','Connect an approved Slack destination separately for a real send.']},
 ]
 const ids=steps.map(()=>crypto.randomUUID())
 return {name:(nova?'NOVA — Weekly restocking':'Forma — Finance review')+' [Demo]',description:'Prepared pitch workflow. No Screenpipe or AI request. Supported browser tasks include verified pre-taught recordings; scheduling and Slack delivery are not connected.',status:'DRAFT',nodes:steps.map((s,i)=>({id:ids[i],type:s.kind==='review'?'CONDITION':'ACTION',label:s.label,positionX:[0,440,880,880,440][i],positionY:[80,0,120,420,480][i],config:{order:i,stepType:s.kind,application:s.app,description:s.description,instructions:s.instructions,startUrl:s.url??null,status:s.kind==='browser'?'needs_recording':'needs_configuration',source:'demo',demoScenario:scenario,originalPrompt:prompt,evidenceIds:[]}})),edges:ids.slice(1).map((id,i)=>({id:crypto.randomUUID(),sourceNodeId:ids[i],targetNodeId:id}))}
}
