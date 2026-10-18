import {useEffect,useRef,useState} from 'react'
import {TeamAvatar} from './TeamAvatar'
type Message={id:string;author:string;text:string;time:string}
const seeds:Message[]=[{id:'sample-1',author:'Sara Benali',text:'Use this space to review inputs, flag missing information and discuss the next run.',time:'Demo'},{id:'sample-2',author:'Alex Martin',text:'Please review the final report before approving any purchases.',time:'Demo'}]
export function TeamDiscussion({topic}:{topic:string}){
 const key='ghost.team.chat.v1:'+topic
 const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[error,setError]=useState('')
 const end=useRef<HTMLDivElement>(null)
 useEffect(()=>{setDraft('');setError('');try{const saved=JSON.parse(localStorage.getItem(key)??'[]');setMessages(Array.isArray(saved)?saved.filter(m=>typeof m.text==='string'&&typeof m.author==='string'&&typeof m.id==='string'&&typeof m.time==='string'):[])}catch{setMessages([]);setError('Saved messages could not be loaded.')}},[key])
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'})},[messages])
 return <aside className="team-chat"><header><small>TEAM DISCUSSION</small><h3>{topic}</h3><p>Demo · Messages stay on this device</p></header><div className="team-chat-messages">{[...seeds,...messages].map(m=><article key={m.id}><TeamAvatar name={m.author}/><div><strong>{m.author}</strong><small>{m.time}</small><p>{m.text}</p></div></article>)}<div ref={end}/></div><form onSubmit={e=>{e.preventDefault();if(!draft.trim())return;const next=[...messages,{id:crypto.randomUUID(),author:'Mohammed Maghri',text:draft.trim(),time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}];try{localStorage.setItem(key,JSON.stringify(next));setMessages(next);setDraft('');setError('')}catch{setError('Message could not be saved.')}}}><label htmlFor="team-chat-message">Message the team</label><textarea id="team-chat-message" maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Leave a note for this space…"/><button className="dash-button" disabled={!draft.trim()}>Post locally →</button>{error&&<p role="alert">{error}</p>}</form></aside>
}
