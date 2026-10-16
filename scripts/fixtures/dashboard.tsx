import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
const params = new URLSearchParams(location.search)
const kind = params.get('kind') || 'B', variant = Number((window as any).__variant || 0)
function Dashboard() {
  const [name, setName] = useState(''), [notes, setNotes] = useState(''), [filter, setFilter] = useState(false), [status, setStatus] = useState(''), [consent, setConsent] = useState(!localStorage.getItem('consent')), [checked, setChecked] = useState(false), [option, setOption] = useState('all')
  const [menu, setMenu] = useState(false)
  return <main className={'layout-' + variant}>
    <h1>Dashboard {kind}</h1>
    {consent && <div role="dialog" aria-label="Cookie consent"><button onClick={() => { localStorage.setItem('consent','yes');setConsent(false) }}>Accept cookies</button></div>}
    <section aria-label="Order editor"><h2>Orders</h2><form onSubmit={e => { e.preventDefault(); setTimeout(() => { setStatus('Report saved'); (window as any).saves = ((window as any).saves || 0) + 1 }, 100 + variant * 30) }}>
      <label>Report name<input id={'react-input-' + Date.now()} value={name} onChange={e=>setName(e.target.value)} /></label>
      <label>Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} /></label>
      <label>Include archived<input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} /></label>
      <label>Region<select value={option} onChange={e=>setOption(e.target.value)}><option value="all">All</option><option value="eu">Europe</option></select></label>
      <div role="textbox" aria-label="Summary" contentEditable suppressContentEditableWarning style={{border:'1px solid',minHeight:30}} />
      <button type="button" aria-expanded={menu} onClick={()=>setTimeout(()=>setMenu(true),100 + variant * 20)}>Filters</button>
      {menu && <div role="dialog" aria-label="Filters"><button type="button" onClick={()=>{setFilter(true);setMenu(false)}}>Apply filters</button></div>}
      <span role="status" id="filter-status">{filter ? 'Filters applied' : ''}</span>
      <button type="submit" className={'save-'+variant}>Save report</button>
      <span role="status" id="result">{status}</span>
    </form></section>
    {kind === 'C' && <section><h2>Unrelated reports</h2><button onClick={()=>{(window as any).wrongClicks=((window as any).wrongClicks||0)+1}}>Save report</button></section>}
    <a href={'/next?kind='+kind}>Next page</a>
  </main>
}
createRoot(document.getElementById('root')!).render(<Dashboard />)
