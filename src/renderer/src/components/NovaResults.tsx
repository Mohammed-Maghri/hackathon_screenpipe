import {NodeRunOutputs} from './NodeRunOutputs'
import {BuyingList} from './BuyingList'
import {useEffect,useState} from 'react'
import {Link} from 'react-router'
import type {NovaRun,NovaSchedule} from '../../../shared/novaPipeline'
export function NovaResults({workflow}: {workflow:string}){
 const [view,setView]=useState('Steps')
 const api=window.ghost?.nova
 const [runs,setRuns]=useState<NovaRun[]>([]),[schedules,setSchedules]=useState<NovaSchedule[]>([]),[workflows,setWorkflows]=useState<{id:string;name:string}[]>([]),[selected,setSelected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const refresh=async()=>{if(!api)return;const data=await api.list();setRuns(data.runs.filter(r=>r.workflowId===workflow));setSchedules(data.schedules.filter(s=>s.workflowId===workflow));setWorkflows(data.workflows)}
 useEffect(()=>{let mounted=true;const load=()=>{if(mounted)void refresh().catch(()=>setError('Unable to load NOVA runs.'))};load();const timer=setInterval(load,2000);return()=>{mounted=false;clearInterval(timer)}},[api,workflow])
 const act=async(action:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await action();await refresh()}catch(e){setError(e instanceof Error?e.message:'Operation failed.')}finally{setBusy(false)}}
 const run=runs.find(r=>r.id===selected)??runs[0], result=run?.recommendation
 const previous=run&&runs.find(r=>r.workflowId===run.workflowId&&r.id!==run.id&&r.startedAt<run.startedAt&&r.recommendation&&['needs_review','approved'].includes(r.state))
 const active=runs.find(r=>r.state==='running')
 if(!api||!workflows.some(w=>w.id===workflow))return <p className="results-muted">No complete workflow run is available here yet. Run the workflow from its board to see node inputs, outputs and reports.</p>
 return <section className="results-card nova-panel"><header><div><p className="results-eyebrow">WORKFLOW REPORT</p><h2>{workflows.find(w=>w.id===workflow)?.name}</h2><p>Fresh data, explained recommendations and files ready to review.</p></div><button className="dash-button dash-button--primary" disabled={busy||!!active} onClick={()=>void act(async()=>{const value=await api.run(workflow);setSelected(value.id)})}>{active?'Running…':'Run workflow'}</button>{active&&<button className="dash-button" onClick={()=>void act(()=>api.cancelRun(active.id))}>Cancel run</button>}</header>
 <div className="nova-result-tabs">{['Steps','Report & files','Schedules'].map(value=><button key={value} aria-pressed={view===value} onClick={()=>setView(value)}>{value}</button>)}</div>
 <div className="nova-result-content">
 {view==='Schedules'&&<><details open><summary>Scheduling and run options</summary><button className="dash-button" disabled={busy||!!active} onClick={()=>void act(()=>api.scheduleTests(workflow))}>Schedule 3 test runs</button><p className="results-footnote">Runs in 1, 2 and 3 minutes, sequentially if busy. Keep Ghost open. Starting or scheduling authorizes the saved browser actions. Completed reports are posted through Screenpipe to GHOST LLC #daily-reports. Buying decisions still wait for approval.</p></details>
 {error&&<p role="alert" className="results-notice">{error}</p>}
 {!!schedules.length&&<details><summary>Test schedules ({schedules.length})</summary>{schedules.map(s=><div className="results-file" key={s.id}><span>{s.label} · {new Date(s.dueAt).toLocaleTimeString()} · {s.state}{s.error&&' · '+s.error}</span>{s.state==='scheduled'&&<button className="dash-button" onClick={()=>void act(()=>api.cancelSchedule(s.id))}>Cancel</button>}</div>)}</details>}
 </>}
 {!run?<p className="results-muted">Run this workflow to see its first report here.</p>:<>
 <div className="nova-controls"><label>Pipeline run <select aria-label="NOVA pipeline run" value={run.id} onChange={e=>setSelected(e.target.value)}>{runs.map(r=><option key={r.id} value={r.id}>{new Date(r.startedAt).toLocaleString()} · {r.state.replaceAll('_',' ')}</option>)}</select></label><Link to={'/workflows/'+run.workflowId} className="dash-button">Open board</Link>{run.scriptRevision&&<button className="dash-button" onClick={()=>void act(()=>window.ghost!.scripts.reveal(run.workflowId,run.scriptRevision!))}>Show node scripts</button>}</div>
 {run.state!=='running'&&run.nodes.every(node=>node.output===undefined)&&<p className="results-notice">Older saved report from {new Date(run.startedAt).toLocaleString()}. It has not been recalculated by the updated runner. Restart Ghost, then choose Run workflow to capture fresh inventory and generate a new report.</p>}
 {view==='Steps'&&<NodeRunOutputs key={run.id} run={run} api={api}/>}
 {view==='Report & files'&&<>
 {run.error&&<p className="results-notice">{run.error}</p>}
 {result&&<><div className="results-stats"><article><span>Recommended units</span><strong>{result.rows.reduce((n,r)=>n+r.buy,0)}</strong></article><article><span>Estimated cost</span><strong>€{result.total.toFixed(2)}</strong><small>{previous?.recommendation?`€${(result.total-previous.recommendation.total).toFixed(2)} vs previous report`:'First report baseline'}</small></article><article><span>Urgent products</span><strong>{result.rows.filter(r=>r.urgent).length}</strong></article><article><span>Budget</span><strong>{result.overBudget?'Over budget':'Within budget'}</strong></article></div>
 <h3>Recommended purchase quantities</h3><div className="nova-bars">{result.rows.map(row=><div key={row.id}><span>{row.name}</span><meter min={0} max={Math.max(1,...result.rows.map(r=>r.buy))} value={row.buy} aria-label={row.name+' recommended units'}/><strong>{row.buy}</strong></div>)}</div>
 <details><summary>Product details and calculations</summary><div className="results-table-wrap"><table><thead><tr><th>Product</th><th>Sales/day</th><th>Stock</th><th>Incoming counted</th><th>Buy</th><th>Cost</th><th>Why</th></tr></thead><tbody>{result.rows.map(row=><tr key={row.id}><td><strong>{row.name}</strong><small>{row.urgent?'Urgent':row.supplier}</small></td><td>{row.dailyRate.toFixed(2)}</td><td>{row.stock}</td><td>{row.eligibleIncoming}</td><td>{row.buy}</td><td>€{row.cost.toFixed(2)}</td><td><details><summary>Calculation</summary>{row.explanation}<p>{row.warning}</p></details></td></tr>)}</tbody></table></div></details></>}
 <BuyingList key={run.id} run={run} previous={previous} onSaved={refresh}/>
 {run.files.map(file=><div className="results-file" key={file.id}><strong>{file.name}</strong><button className="dash-button" onClick={()=>void act(()=>api.reveal(run.id,file.id))}>Show file</button></div>)}
 {run.draft&&<div className="nova-draft"><h3>{run.delivery?.state==='sent'?'Sent to #daily-reports':run.delivery?.state==='unknown'?'Delivery unconfirmed — check Slack':'Slack draft · not sent'}</h3><p>{run.draft}</p><button className="dash-button" onClick={()=>void act(()=>navigator.clipboard.writeText(run.draft!))}>Copy message</button></div>}
 {run.state==='needs_review'&&<button className="dash-button dash-button--primary" disabled={busy} onClick={()=>void act(()=>api.approve(run.id))}>Approve this report</button>}{run.approvedAt&&<p className="results-verified">Approved {new Date(run.approvedAt).toLocaleString()}. {run.delivery?.state==='sent'?'Report posted to #daily-reports.':'See message delivery status above.'}</p>}
 </>}
 </>}
 </div>
 </section>
}
