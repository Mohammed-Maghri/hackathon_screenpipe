import {appIdentity} from '../data/appIdentity'
import {useEffect,useState} from 'react'
import {localDayRange,type ActivityTimelineResult} from '../../../shared/activityTimeline'
import {AppMark} from './AppMark'
const demoActivity = [
 {name:'EmDash',time:'16:42',minutes:18,description:'Working in hackathon_screenpipe'},
 {name:'Screenpipe',time:'16:24',minutes:6,description:'Reviewing captured work activity'},
 {name:'Codex',time:'16:18',minutes:12,description:'Building the Ghost workflow board'},
 {name:'Chrome',time:'16:06',minutes:8,description:'Testing NOVA sales and inventory'},
 {name:'Slack',time:'15:58',minutes:5,description:'Sharing the weekly report'},
 {name:'Discord',time:'15:53',minutes:7,description:'Coordinating the hackathon demo'},
 {name:'ChatGPT',time:'15:46',minutes:9,description:'Planning the restocking workflow'},
 {name:'EmDash',time:'15:37',minutes:14,description:'Reviewing changes in the Ghost project'},
 {name:'Chrome',time:'15:23',minutes:8,description:'Checking Forma payment filters'},
 {name:'Excel',time:'15:15',minutes:10,description:'Reviewing the weekly buying list'},
 {name:'Screenpipe',time:'15:05',minutes:6,description:'Exploring the afternoon activity timeline'},
 {name:'Codex',time:'14:59',minutes:16,description:'Improving browser replay verification'},
 {name:'Slack',time:'14:43',minutes:4,description:'Reading the team’s progress updates'},
 {name:'Chrome',time:'14:39',minutes:7,description:'Testing the inventory export'},
 {name:'Discord',time:'14:32',minutes:9,description:'Discussing the presentation walkthrough'},
 {name:'Notion',time:'14:23',minutes:11,description:'Updating the hackathon checklist'},
 {name:'Gmail',time:'14:12',minutes:5,description:'Reviewing report delivery drafts'},
 {name:'EmDash',time:'14:07',minutes:18,description:'Working on the Home activity panel'},
 {name:'Screenpipe',time:'13:49',minutes:7,description:'Reviewing recorded application sessions'},
]

const ignoreData = (_value:ActivityTimelineResult|null) => {}
export function HomeActivity({onConnection,onData=ignoreData}:{onConnection:(value:string)=>void;onData?:(value:ActivityTimelineResult|null)=>void}){
 const [result,setResult]=useState<ActivityTimelineResult|null>(null)
 useEffect(()=>{let alive=true;setResult(null);onData(null);onConnection('Checking Screenpipe…');const api=window.ghost?.activityTimeline
 if(!api){onConnection('Screenpipe unavailable');setResult({ok:false,code:'disconnected',error:'Open Ghost desktop to connect to Screenpipe.'});onData({ok:false,code:'disconnected',error:'Open Ghost desktop to connect to Screenpipe.'});return}
 void api(localDayRange(new Date())).then(data=>{if(alive){setResult(data);onData(data);onConnection(data.ok?'Screenpipe connected':'Screenpipe unavailable')}}).catch(()=>{if(alive){setResult({ok:false,code:'disconnected',error:'Open Screenpipe and try again.'});onData({ok:false,code:'disconnected',error:'Open Screenpipe and try again.'});onConnection('Screenpipe disconnected')}})
 return()=>{alive=false}
 },[onConnection,onData])
 const measuredRows=result?.ok?result.buckets.flatMap(bucket=>bucket.apps.filter(app=>app.minutes>0).map(app=>({...app,time:bucket.startTime,description:'Measured screen activity'}))).sort((a,b)=>b.time.localeCompare(a.time)):[]
 const isDemo=result!==null&&measuredRows.length===0
 const rows=isDemo?demoActivity:measuredRows
 return <section className="home-latest-panel"><header><h2>Your latest activity</h2><span>{isDemo?'Demo · Today':'Today'}</span></header><div className="home-latest-list" tabIndex={0} role="region" aria-label="Recent application activity">
 {!result?<p className="home-panel-message" role="status">Loading activity…</p>:rows.map((row,i)=><div className="home-activity-row" title={row.description} key={row.time+row.name+i}><time>{isDemo?row.time:new Date(row.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time><AppMark app={row.name}/><strong title={row.name}>{appIdentity(row.name)}</strong><span className="home-activity-description">{row.description}</span><small>{row.minutes.toFixed(0)} min</small></div>)}
 </div></section>
}
