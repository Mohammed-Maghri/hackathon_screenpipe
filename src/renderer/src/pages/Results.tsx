import {NovaResults} from '../components/NovaResults'
import {useEffect,useState} from 'react'
import {useSearchParams} from 'react-router'
import {RefreshCw} from 'lucide-react'
import {TitleBar} from '../components/TitleBar'
import {WorkflowSidebar} from '../components/WorkflowSidebar'
import {workflowClient} from '../data/workflowClient'
import '../styles/results.css'
export function Results(){
 const [params,setParams]=useSearchParams()
 const filter=params.get('workflow')??''
 const [names,setNames]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0)
 useEffect(()=>{
  let active=true;setLoading(true);setError('')
  async function load(){
   const entries:Record<string,string>={}
   const results=await Promise.allSettled([workflowClient.listWorkflows(0,{limit:100}),window.ghost?.nova?.list()])
   const saved=results[0];if(saved.status==='fulfilled'&&saved.value.ok)for(const workflow of saved.value.items)entries[workflow.id]=workflow.name
   const local=results[1];if(local.status==='fulfilled'&&local.value)for(const workflow of local.value.workflows)entries[workflow.id]??=workflow.name
   if(active){setNames(entries);if(!Object.keys(entries).length&&saved.status==='rejected')setError('Unable to load workflows. Try refreshing.');setLoading(false)}
  }
  void load();return()=>{active=false}
 },[refresh])
 const ids=Object.keys(names)
 useEffect(()=>{if(!filter&&ids.length)setParams({workflow:ids[0]})},[filter,ids.join(',')])
 return <div className="results-shell"><WorkflowSidebar active="results"/><div className="results-body">{window.ghost?.platform!=='darwin'&&<TitleBar/>}<main className="results-page">
 <header className="results-heading"><div><p className="results-eyebrow">GHOST / RESULTS</p><h1>{names[filter]??'Workflow results'}</h1></div><button className="dash-button" disabled={loading} onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={15}/>Refresh</button></header>
 <div className="results-toolbar"><label htmlFor="results-workflow">Workflow</label><select id="results-workflow" value={filter} onChange={event=>setParams({workflow:event.target.value})}><option value="" disabled>Select a workflow</option>{ids.map(id=><option key={id} value={id}>{names[id]}</option>)}{filter&&!names[filter]&&<option value={filter}>Selected workflow</option>}</select><span>Saved on this device</span></div>
 {error&&<p role="alert" className="results-notice">{error}</p>}
 <NovaResults key={filter+':'+refresh} workflow={filter}/>
 </main></div></div>
}
