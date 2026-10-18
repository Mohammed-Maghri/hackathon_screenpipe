import { DashboardDialog } from './DashboardDialog'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { localDayRange, type ActivityRange, type ActivityTimelineResult } from '../../../shared/activityTimeline'
const hour = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
function localInput(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
const recentRange = ():ActivityRange => { const end=Math.floor(Date.now()/1000)*1000; return {startTime:new Date(end-7200000).toISOString(),endTime:new Date(end).toISOString()} }
export function ActivityTimeline({ busy, onDiscover, recent = false }: { busy: boolean; onDiscover: (range: ActivityRange) => void; recent?:boolean }) {
  const [details, setDetails] = useState(false)
  const [filter, setFilter] = useState(recent?'Last 2 Hours':'Today')
  const [day, setDay] = useState(() => recent?recentRange():localDayRange(new Date()))
  const [selection, setSelection] = useState<ActivityRange | null>(null)
  const [result, setResult] = useState<ActivityTimelineResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [manual, setManual] = useState({ start: '', end: '' })
  const [manualError, setManualError] = useState('')
  const drag = useRef<number | null>(null)
  const bars = useRef<HTMLDivElement>(null)
  const days = Array.from({ length: 7 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - 6 + i); return localDayRange(date) })
  const choose = (range: ActivityRange) => { setSelection(range); setManual({ start: localInput(range.startTime), end: localInput(range.endTime) }); setManualError('') }
  const changeDay = (range: ActivityRange) => { setDay(range); setSelection(null); setManual({ start: '', end: '' }); setManualError('') }
  useEffect(() => {
    let active = true; setLoading(true); setResult(null)
    if (!window.ghost?.activityTimeline) { setResult({ ok: false, code: 'disconnected', error: window.ghost ? 'Ghost is running an older desktop bridge. Fully quit and reopen Ghost to load the new activity integration; refreshing the page is not enough.' : 'This is the web preview. Open the Ghost desktop app to connect to local Screenpipe activity.' }); setLoading(false); return }
    void window.ghost.activityTimeline(day).then(value => { if (active) setResult(value) }).catch(() => { if (active) setResult({ ok: false, code: 'disconnected', error: 'Unable to reach Screenpipe. Open Screenpipe and try again.' }) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [day.startTime, day.endTime, refresh])
  useEffect(()=>{
    if(filter!=='Last 2 Hours') return
    const timer=setInterval(()=>{if(!selection && drag.current===null) setDay(recentRange())},60000)
    return()=>clearInterval(timer)
  },[filter,selection])
  const buckets = result?.ok ? result.buckets : []
  const total = buckets.reduce((sum, bucket) => sum + bucket.minutes, 0)
  const slots = filter==='Last 2 Hours'?24:Math.round((Date.parse(day.endTime) - Date.parse(day.startTime)) / 3600000)
  const apps = new Map<string, number>()
  for (const bucket of buckets) for (const app of bucket.apps) apps.set(app.name, (apps.get(app.name) ?? 0) + app.minutes)
  function selectBars(from: number, to: number) {
    const first = buckets[Math.min(from, to)], last = buckets[Math.max(from, to)]
    if (first && last) choose({ startTime: first.startTime, endTime: last.endTime })
  }
  function pointerIndex(clientX: number) {
    const rect = bars.current!.getBoundingClientRect()
    return Math.max(0, Math.min(buckets.length - 1, Math.floor((clientX - rect.left) / rect.width * slots)))
  }
  function edit(which: 'start' | 'end', value: string) {
    const next = { ...manual, [which]: value }; setManual(next)
    const start = new Date(next.start).getTime(), end = new Date(next.end).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || start < Date.parse(day.startTime) || end > Math.min(Date.now(), Date.parse(day.endTime))) { setManualError('Choose a start before the end, within the selected day and no later than now.'); return }
    setManualError(''); setSelection({ startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString() })
  }
  return <section className="activity-timeline mt-auto shrink-0 rounded-xl border border-line bg-panel p-3" data-home={recent||undefined} data-period={filter} aria-labelledby="activity-timeline-title" aria-busy={loading}>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="hidden font-sans text-[10px] uppercase tracking-widest text-muted">Screenpipe · Local activity</p><h2 id="activity-timeline-title" className="text-base font-semibold">Activity timeline</h2></div><div className="flex flex-wrap gap-1 rounded-lg border border-line bg-canvas p-1" aria-label="Activity period">{['Last 2 Hours', 'Today', 'Yesterday', 'Last 7 Days'].map(value => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); const date = new Date(); if (value === 'Yesterday') date.setDate(date.getDate() - 1); changeDay(value==='Last 2 Hours'?recentRange():localDayRange(date)) }} className={`rounded-md px-2.5 py-2 text-xs ${filter === value ? 'bg-action-fill text-on-action' : 'text-muted hover:bg-sunken'}`}>{value}</button>)}</div></header>
    {filter === 'Last 7 Days' && <label className="activity-day-selector mt-2 flex items-center gap-2 text-xs text-muted">Day<select aria-label="Day within last seven days" className="rounded border border-line bg-canvas px-2 py-1" value={day.startTime} onChange={event => { const next = days.find(d => d.startTime === event.target.value); if (next) changeDay(next) }}>{days.map(range => <option key={range.startTime} value={range.startTime}>{new Date(range.startTime).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}</select><span className="ml-auto text-live">{total.toFixed(1)} min</span></label>}
    {loading ? <div className="my-2 flex h-24 items-center justify-center gap-2 rounded-xl bg-sunken/40 text-sm text-muted" role="status"><RefreshCw size={16} className="animate-spin motion-reduce:animate-none" />Loading measured activity…</div> : result && !result.ok ? <div className="my-2 rounded-xl border border-line bg-canvas p-5" role="status"><p className="text-sm font-medium">{result.code === 'disconnected' ? 'Screenpipe is disconnected' : 'Activity unavailable'}</p><p className="mt-2 text-xs leading-relaxed text-muted">{result.error}</p><button className="dash-button mt-4" onClick={() => { if(filter==='Last 2 Hours') changeDay(recentRange()); else setRefresh(v => v + 1) }}>Try again</button></div> : <>
      <div className="activity-metrics mt-2 flex items-end justify-between gap-3"><div className="flex flex-wrap items-baseline gap-2"><strong className="text-base font-semibold tabular-nums">{total.toFixed(1)} <span className="text-sm font-normal text-muted">min</span></strong><p className="text-[11px] text-muted">Measured screen activity · {new Date(day.startTime).toLocaleDateString()}</p></div><button className="text-button" aria-label="Refresh activity" onClick={() => { if(filter==='Last 2 Hours') changeDay(recentRange()); else setRefresh(v => v + 1) }}><RefreshCw size={13} />Refresh</button></div>
      <div className="activity-chart-surface mt-2 rounded-lg border border-line bg-canvas px-2 py-1.5">
        <div ref={bars} className="activity-chart-bars relative grid h-14 touch-pan-y select-none items-end gap-1 border-b border-line" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0,1fr))` }} onPointerDown={event => { if (event.button !== 0 || !buckets.length) return; const i = pointerIndex(event.clientX); drag.current = i; event.currentTarget.setPointerCapture(event.pointerId); selectBars(i, i) }} onPointerMove={event => { if (drag.current !== null) selectBars(drag.current, pointerIndex(event.clientX)) }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}>
          {Array.from({ length: slots }, (_, index) => { const bucket = buckets[index]; const selected = bucket && selection && Date.parse(bucket.startTime) < Date.parse(selection.endTime) && Date.parse(bucket.endTime) > Date.parse(selection.startTime); return <button type="button" key={index} disabled={!bucket} aria-pressed={Boolean(selected)} aria-label={bucket ? `${hour(bucket.startTime)}: ${bucket.minutes.toFixed(1)} active minutes. ${bucket.apps.map(a => `${a.name} ${a.minutes.toFixed(1)} minutes`).join(', ')}` : 'Not yet recorded'} title={bucket ? `${hour(bucket.startTime)} · ${bucket.minutes.toFixed(1)} min` : 'Not yet recorded'} onClick={event => { if (event.detail === 0) selectBars(index, index) }} className={`group flex h-full min-w-0 items-end rounded-t-sm px-px focus-visible:outline-2 focus-visible:outline-action-line ${selected ? 'bg-action-fill/15' : 'hover:bg-sunken'}`}><span className={`block w-full rounded-t-sm ${selected ? 'bg-action-fill' : 'bg-live/65'}`} style={{ height: bucket?.minutes ? `${Math.min(100, bucket.minutes / ((Date.parse(bucket.endTime)-Date.parse(bucket.startTime))/60000) * 100)}%` : '2px', opacity: bucket?.minutes ? 1 : 0.18 }} /></button> })}
        </div><div className="mt-2 flex justify-between font-sans text-[10px] text-muted">{Array.from({length:5},(_,i)=><span key={i}>{hour(new Date(Date.parse(day.startTime)+(Date.parse(day.endTime)-Date.parse(day.startTime))*i/4).toISOString())}</span>)}</div>
      </div>
      {total === 0 ? <p className="mt-3 text-xs leading-relaxed text-muted">{result?.ok && result.dataStatus === 'not_recording' ? 'Screenpipe reports that recording is not active.' : 'No measured screen activity for this day. Audio-only recordings do not appear in this chart.'}</p> : null}
      <div className="activity-chart-footer mt-2 flex flex-wrap items-center justify-between gap-2"><button className="text-button" onClick={() => setDetails(true)}>{selection ? `${hour(selection.startTime)}–${hour(selection.endTime)} · Edit range` : 'Drag to select · Edit range & apps'}</button><button className="dash-button dash-button--primary min-h-8 px-3 py-1.5 text-xs" disabled={busy || !selection || !!manualError} onClick={() => { if (selection) onDiscover(selection) }}>Discover Workflow <ArrowRight size={13} /></button></div>
      {details && <DashboardDialog title="Activity details" onClose={() => setDetails(false)}><p className="text-xs leading-relaxed text-muted">Screenpipe’s measured activity for {new Date(day.startTime).toLocaleDateString()}. Local device time; capture counts are never converted into minutes.</p><ul className="mt-4 grid list-none gap-2 p-0">{[...apps].sort((a,b) => b[1]-a[1]).map(([name, minutes]) => <li key={name} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas p-3 text-sm"><span className="break-words">{name}</span><span className="shrink-0 font-sans text-xs text-live">{minutes.toFixed(1)} min</span></li>)}</ul>{apps.size === 0 && <p className="mt-3 text-sm text-muted">No application durations were reported.</p>}
      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">{(['start', 'end'] as const).map(which => <label key={which} className="grid min-w-0 flex-1 gap-1.5 text-xs text-muted">{which === 'start' ? 'From' : 'To'}<input type="datetime-local" className="w-full rounded-lg border border-line bg-canvas px-2 py-2 text-xs text-ink" value={manual[which]} min={localInput(day.startTime)} max={localInput(new Date(Math.min(Date.parse(day.endTime), Date.now())).toISOString())} onChange={event => edit(which, event.target.value)} /></label>)}<button className="dash-button dash-button--primary" disabled={busy || !selection || !!manualError} onClick={() => { if (selection) onDiscover(selection) }}>Discover Workflow <ArrowRight size={14} /></button></div>
      {manualError && <p role="alert" className="mt-2 text-xs text-danger">{manualError}</p>}<button className="dash-button mt-4" onClick={() => setDetails(false)}>Done</button></DashboardDialog>}
    </>}
  </section>
}
