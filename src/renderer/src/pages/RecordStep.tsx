import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, CircleDot, Globe, Lightbulb, LoaderCircle, LockKeyhole, Maximize, Pause, Play, RotateCw, Square, X } from '../components/ImageIcon'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { ReplaySummary } from '../components/ReplaySummary'
import { AppMark } from '../components/AppMark'
import { DashboardDialog } from '../components/DashboardDialog'
import { useWorkflows } from '../data/workflowStore'
import { editorSnapshots, makeNodes } from '../data/editorState'
import type { RecordedEvent, RecordingStatus, ReplayPreview, ReplayStatus } from '../../../shared/recording'
import type { BrowserBounds, BrowserState } from '../../../shared/browser'
import '../styles/dashboard.css'
import '../styles/workflow-editor.css'
import '../styles/record-step.css'

function eventLabel(event: RecordedEvent) {
  const target = event.data.target as { label?: string; text?: string; selector?: string; redacted?: boolean } | undefined
  const labels: Record<string, string> = { navigation: 'Navigated to', 'frame-navigation': 'Frame navigated to', input: 'Changed field', click: 'Clicked', dblclick: 'Double-clicked', pointerdown: 'Pointer down', pointerup: 'Pointer up', 'drag-move': 'Dragged', keydown: 'Pressed key', scroll: 'Scrolled', submit: 'Submitted form', 'page-ready': 'Page ready', 'download-start': 'Download started', 'download-done': 'Download finished', 'edit-shortcut': 'Edited field' }
  return { label: labels[event.type] ?? event.type, detail: event.type === 'frame-navigation' ? String(event.data.destination ?? '') : event.type === 'navigation' ? event.url : target?.redacted ? 'Sensitive field · value redacted' : target?.label || target?.text || target?.selector || event.url }
}
const startingURLs: Record<string, string> = { Slack: 'https://app.slack.com', Gmail: 'https://mail.google.com', Notion: 'https://www.notion.so', Drive: 'https://drive.google.com', Excel: 'https://www.microsoft365.com', Chrome: 'https://example.com' }
function elapsedLabel(seconds: number) { return `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor(seconds / 60 % 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}` }
export function RecordStep() {
  const { id, nodeId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const workflows = useWorkflows()
  const workflow = workflows.find(item => item.id === id)
  const snapshot = editorSnapshots.get(id ?? '')
  const node = (snapshot?.nodes ?? (workflow ? makeNodes(workflow) : [])).find(item => item.id === nodeId)
  const browser = window.ghost?.browser
  const startURL = node?.startUrl !== undefined ? node.startUrl ?? 'about:blank' : startingURLs[node?.app ?? 'Chrome'] ?? 'https://example.com'
  const [address, setAddress] = useState(startURL === 'about:blank' ? '' : startURL)
  const [state, setState] = useState<BrowserState>({ sessionId: '', url: startURL, title: node?.app ?? 'Browser', loading: false, canGoBack: false, canGoForward: false, error: null })
  const [sessionAttempt, setSessionAttempt] = useState(location.state?.fresh === true ? 1 : 0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [paused, setPaused] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [events, setEvents] = useState<RecordedEvent[]>([])
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus | null>(null)
  const [recordingBusy, setRecordingBusy] = useState(false)
  const [diagnostics, setDiagnostics] = useState('')
  const [eventTab, setEventTab] = useState('Steps')
  const [completed, setCompleted] = useState<number[]>([])
  const [help, setHelp] = useState(false)
  const [inspectedEvent, setInspectedEvent] = useState<RecordedEvent | null>(null)
  const [preview, setPreview] = useState<ReplayPreview | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [replay, setReplay] = useState<ReplayStatus | null>(null)
  const replaying = replay?.state === 'running' || replay?.state === 'needs-user-approval'
  const [wide, setWide] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const token = useRef('')
  const replayMode = useRef<'fast' | 'demo'>('fast')
  const lastURL = useRef('')
  function bounds(): BrowserBounds {
    const rect = viewport.current?.getBoundingClientRect()
    return { x: rect?.x ?? 0, y: rect?.y ?? 0, width: rect?.width ?? 0, height: rect?.height ?? 0, visible: !document.querySelector('dialog[open]') && !document.hidden }
  }
  useLayoutEffect(() => { if (ready && browser) browser.bounds(token.current, bounds()) }, [browser, ready, wide, help, inspectedEvent, preview, showResults, replay?.state, error, state.error])
  useEffect(() => {
    if (!browser || !node || !viewport.current) return
    const sessionId = crypto.randomUUID(); token.current = sessionId
    setReady(false); setError(''); setEvents([]); setSeconds(0); setPaused(false); setStopped(false); setRecordingStatus(null); setShowResults(false); setReplay(null); setPreview(null); setCompleted([])
    let disposed = false
    let received = false
    const unsubscribe = browser.onState(next => {
      if (disposed || next.sessionId !== sessionId) return
      received = true; setState(next)
      if (next.authenticationPaused) { setPaused(true); void browser.recordingStatus(sessionId).then(setRecordingStatus).catch(() => {}) }
      if (next.url && next.url !== lastURL.current) { setAddress(next.url === 'about:blank' ? '' : next.url); lastURL.current = next.url }
    })
    const offReplay = browser.onReplay(value => { if (!disposed && value.sessionId === sessionId) { setReplay(value.status); if (value.status.state === 'completed') setShowResults(true); else if (value.status.state === 'running') setShowResults(false) } })
    const offEvents = browser.onRecorded(value => { if (!disposed && value.sessionId === sessionId) { setEvents(current => [...current, value.event].slice(-300)); setRecordingStatus(value.status) } })
    void browser.open(sessionId, sessionAttempt && /^https?:/.test(state.url) ? state.url : startURL, bounds(), sessionAttempt > 0).then(initial => { if (!disposed) { if (!received) setState(initial); setReady(true); void browser.recordingStatus(sessionId).then(async saved => { if (disposed) return; setRecordingStatus(saved); setStopped(saved.state === 'stopped'); setPaused(saved.state === 'paused'); if (saved.state === 'stopped') { const data = JSON.parse(await browser.recordingExport(sessionId)); if (!disposed) setEvents(data.events.slice(-300)); } }).catch(reason => { if (!disposed) setError(String(reason)) }) } }).catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : 'Unable to open the browser.') })
    const position = () => { if (!disposed) browser.bounds(sessionId, bounds()) }
    const resize = new ResizeObserver(position); resize.observe(viewport.current)
    const dialogs = new MutationObserver(position); dialogs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    document.addEventListener('visibilitychange', position)
    return () => { disposed = true; unsubscribe(); offEvents(); offReplay(); resize.disconnect(); dialogs.disconnect(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); document.removeEventListener('visibilitychange', position); void browser.close(sessionId).catch(() => {}) }
  // One native view per teaching route; UI state must not recreate the website.
  }, [browser, id, nodeId, startURL, sessionAttempt])
  useEffect(() => { if (!ready || paused || stopped) return; const interval = window.setInterval(() => setSeconds(value => value + 1), 1000); return () => window.clearInterval(interval) }, [ready, paused, stopped])
  async function go(event: FormEvent) {
    event.preventDefault(); setError('')
    try { await browser?.navigate(token.current, address) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to navigate.') }
  }
  async function action(value: 'back' | 'forward' | 'reload' | 'stop') {
    setError('')
    try { await browser?.action(token.current, value) } catch { setError('Browser action failed. Please try again.') }
  }
  async function controlRecording(action: 'pause' | 'resume' | 'stop') {
    if (!browser) return
    setRecordingBusy(true); setError('')
    try {
      const status = await browser.recordingControl(token.current, action)
      setRecordingStatus(status); setPaused(status.state === 'paused'); setStopped(status.state === 'stopped')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save the recording.') }
    finally { setRecordingBusy(false) }
  }
  async function startCleanRecording() {
    if (!browser || recordingBusy) return
    setRecordingBusy(true); setError('')
    try {
      await browser.recordingControl(token.current, 'stop')
      setPreview(null)
      setSessionAttempt(value => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to start a new recording.') }
    finally { setRecordingBusy(false) }
  }
  async function previewReplay() {
    try { if (browser) setPreview(await browser.replayPreview(token.current)) } catch (reason) { setError(String(reason)) }
  }
  async function startReplay(mode: 'fast' | 'demo' = 'fast') {
    setShowResults(false)
    replayMode.current = mode
    setPreview(null); setWide(false); setError('')
    setReplay({ state: 'running', completed: 0, total: preview?.steps ?? 0, sequence: null, action: 'Preparing', error: null })
    try { await browser?.replayStart(token.current, true, false, mode) } catch (reason) { setReplay({ state: 'failed', completed: 0, total: 0, sequence: null, action: 'Preparing', error: String(reason) }) }
  }
  async function cancelReplay() {
    try { await browser?.replayCancel(token.current) } catch (reason) { setError(String(reason)) }
  }
  async function exportSession() {
    if (!browser) return
    try {
      const data = await browser.recordingExport(token.current)
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = `ghost-recording-${recordingStatus?.id ?? 'session'}.json`; link.click(); URL.revokeObjectURL(url)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to export the recording.') }
  }
  async function exitRecording() {
    if (replaying) await cancelReplay()
    if (ready && !stopped && browser) {
      try { await browser.recordingControl(token.current, 'stop') } catch (reason) { setError(String(reason)); return }
    }
    navigate(`/workflows/${id}`)
  }
  useEffect(() => {
    if (!browser || !ready) return
    const interval = window.setInterval(() => { void browser.recordingStatus(token.current).then(setRecordingStatus).catch(() => {}) }, 1500)
    return () => window.clearInterval(interval)
  }, [browser, ready, stopped])
  if (!workflow || !node) return <div className="editor-not-found"><h1>Step not found.</h1><Link className="dash-button" to={`/workflows/${id}`}>Back to workflow</Link></div>
  const instructions = node.instructions.length ? node.instructions : [node.description || 'Record the complete process in the browser']
  const active = instructions.findIndex((_instruction, index) => !completed.includes(index))
  return <div className={`record-shell ${wide ? 'record-shell--wide' : ''}`}>
    <WorkflowSidebar />
    <main className="record-main">
      <header className="record-header"><nav aria-label="Breadcrumb"><Link to="/workflows"><ArrowLeft size={14} />Workflows</Link><ChevronRight size={13} /><Link to={`/workflows/${id}`}>{snapshot?.title ?? workflow.name}</Link><ChevronRight size={13} /><span>Record Step</span></nav><div><h1>{stopped ? 'Saved browser step' : 'Record Step'}</h1><div className="record-header-actions">{stopped && <button className="dash-button" disabled={!ready || recordingBusy || replaying} onClick={() => void startCleanRecording()}>Record again</button>}{replaying && <button className="stop-recording" onClick={() => void cancelReplay()}>Cancel test</button>}<button className="text-button" disabled={replaying} onClick={() => setHelp(true)}><CircleHelp size={18} />Need help?</button><button className="dash-button" onClick={() => void exitRecording()}><X size={16} />Exit recording</button></div></div><p>Record the entire browser process for this node, from the starting page through the final result.</p></header>
      {state.authenticationPaused && <div className="authentication-banner" role="status"><div><strong>Capture paused for sign-in</strong><p>Use Login settings to save your credentials and sign in automatically. Then start task recording on the dashboard. Saved login runs before each replay.</p></div><button className="dash-button dash-button--primary" disabled={!ready || recordingBusy || replaying} onClick={() => void startCleanRecording()}>Start task recording</button></div>}
      <div className="record-workspace">
        <section className="record-instructions"><div className="record-node-info">{node.kind === 'Browser action' || node.app ? <AppMark app={node.kind === 'Browser action' ? 'Chrome' : node.app!} /> : <Globe size={30} />}<div><h2>{node.title}</h2><p>{node.kind}</p></div></div><span className="record-pill"><CircleDot size={12} />{!browser ? 'Desktop required' : stopped ? 'Session stopped' : paused ? 'Paused' : 'Teaching session'}</span><div className="record-progress"><div><span>{completed.length} of {instructions.length} completed</span><span>{Math.round(completed.length / instructions.length * 100)}%</span></div><progress value={completed.length} max={instructions.length} /></div><ol>{instructions.map((instruction, index) => <li key={index}><button className={`${active === index ? 'is-active' : ''} ${completed.includes(index) ? 'is-complete' : ''}`} aria-pressed={completed.includes(index)} onClick={() => setCompleted(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index])}><span>{completed.includes(index) ? <Check size={14} /> : index + 1}</span><div><strong>{instruction}</strong><small>{completed.includes(index) ? 'Completed · click to undo' : 'Click when you complete this action'}</small></div></button></li>)}</ol><div className="record-tip"><Lightbulb size={20} /><div><strong>Tip</strong><p>Use the browser naturally. Mark each instruction complete as you go.</p></div></div></section>
        <section className="teaching-browser" aria-label="Embedded website"><div className="browser-tab"><Globe size={14} /><span>{state.title || node.app || 'Browser'}</span><span className="browser-tab-note">Teaching browser</span></div><form className="browser-address" onSubmit={go}><button type="button" title="Back" aria-label="Browser back" disabled={replaying || !ready || !state.canGoBack} onClick={() => void action('back')}><ArrowLeft size={19} /></button><button type="button" title="Forward" aria-label="Browser forward" disabled={replaying || !ready || !state.canGoForward} onClick={() => void action('forward')}><ArrowRight size={19} /></button><button type="button" aria-label={state.loading ? 'Stop loading' : 'Reload page'} disabled={replaying || !ready} onClick={() => void action(state.loading ? 'stop' : 'reload')}>{state.loading ? <X size={18} /> : <RotateCw size={17} />}</button><label>{state.url.startsWith('https:') ? <LockKeyhole size={13} /> : <Globe size={13} />}<input aria-label="Website address" placeholder="Search Google or enter a URL" value={address} onChange={event => setAddress(event.target.value)} onFocus={event => event.target.select()} spellCheck={false} autoComplete="off" disabled={replaying || !ready} /></label><button type="submit" aria-label="Navigate to website" disabled={replaying || !ready}><ArrowRight size={17} /></button><button type="button" aria-label="Expand browser viewport" aria-pressed={wide} onClick={() => setWide(value => !value)}><Maximize size={17} /></button></form>
          <div className={`browser-loading-bar ${state.loading ? 'is-loading' : ''}`} role="status" aria-label={state.loading ? 'Page loading' : 'Page loaded'} />
          {(error || state.error) && <div className="browser-error" role="alert">{error || state.error}<button disabled={replaying} onClick={() => void action('reload')}>Retry</button></div>}
          <div className="browser-viewport" ref={viewport}>{!browser ? <div className="browser-placeholder"><Globe size={42} /><h2>Your teaching browser lives here.</h2><p>Open Ghost in Electron to browse websites in this workspace.</p><span>Address bar, navigation, and live pages are available in the desktop app.</span></div> : !ready ? <div className="browser-placeholder"><LoaderCircle className="spinning" size={28} /><p>Opening your browser…</p></div> : null}</div>
        </section>
        <section className="record-events"><header><span className={`record-status-dot ${paused || stopped || !ready ? 'is-idle' : ''}`} /><strong>{!ready ? 'Not recording' : stopped ? 'Stopped' : paused ? 'Paused' : 'Recording actions'}</strong><time>{elapsedLabel(seconds)}</time></header><nav>{['Steps', 'Console'].map(value => <button key={value} className={eventTab === value ? 'is-active' : ''} onClick={() => setEventTab(value)}>{value}</button>)}</nav><div className="record-event-scroll">{eventTab === 'Steps' ? events.length ? <ol>{events.map((event, index) => <li key={index}><i /><button className="recorded-event-detail" disabled={replaying} onClick={() => setInspectedEvent(event)} aria-label={`Inspect event ${event.sequence}: ${eventLabel(event).label}`}><strong>{eventLabel(event).label}</strong><p>{eventLabel(event).detail}</p><small>View captured details</small></button><time>{elapsedLabel(event.elapsedMs / 1000).slice(3)}</time></li>)}</ol> : <p className="record-empty">{browser ? 'Clicks, typing, scrolls, and navigation will appear as you browse.' : 'Launch the desktop app to start a live session.'}</p> : <div className="record-console"><button className="dash-button" onClick={() => void browser?.diagnostics(token.current).then(value => setDiagnostics(JSON.stringify(value, null, 2))).catch(reason => setDiagnostics(String(reason)))}>Check browser interaction</button><pre className="recording-event-json">{diagnostics}</pre><p>Capture: clicks, field changes, keys, scrolling, navigation</p><p>Events saved: {recordingStatus?.eventCount ?? 0}</p><p>Local folder: {recordingStatus?.path ?? 'Starting…'}</p><p>Browser: {ready ? 'connected' : 'not connected'}</p><p>Page: {state.loading ? 'loading' : 'idle'}</p><p>Passwords and passcodes are encrypted locally; other sensitive fields are redacted. Supported embedded frames are captured, including cross-origin frames. Ambiguous frames and closed shadow roots remain unsupported.</p>{recordingStatus?.error && <p role="alert">Save error: {recordingStatus.error}</p>}{(error || state.error) && <p>{error || state.error}</p>}</div>}</div><footer>{replay && <div className="replay-progress" role="status"><strong>{replayMode.current === 'demo' ? 'Demo replay' : 'Test'} {replay.state}</strong><p>{replay.completed} / {replay.total} verified or skipped actions · {replay.action}</p>{replay.error && <p>{replay.failureCode && <strong>{replay.failureCode}: </strong>}{replay.error}</p>}{!replaying && replay.runId && <button className="dash-button" onClick={() => setShowResults(true)}>View run results</button>}{replay.resumable && <button className="dash-button" onClick={() => { void browser?.replayStart(token.current, true, true, replayMode.current).catch(reason => setError(String(reason))) }}>Revalidate and resume</button>}{replay.results && <details className="replay-results"><summary>Action results</summary><ul>{replay.results.map(item => <li key={item.sequence}>#{item.sequence} {item.type}: {item.state}{item.evidence && <p>{item.evidence}</p>}{item.diagnostics && <pre className="recording-event-json">{JSON.stringify(item.diagnostics, null, 2)}</pre>}</li>)}</ul></details>}{replay.state === 'completed' && <p>Recorded observable outcomes verified. Business results still require review.</p>}</div>}{replaying ? <button className="stop-recording" onClick={() => void cancelReplay()}>Cancel test</button> : stopped ? <><button className="dash-button dash-button--primary" onClick={() => void previewReplay()}><Play size={14} />Test recording</button><button className="dash-button dash-button--primary" onClick={() => void exportSession()}>Export session</button><button className="dash-button" onClick={() => void startCleanRecording()}>New recording on this page</button><button className="dash-button" onClick={() => void exitRecording()}>Back to workflow</button></> : <><button className="dash-button" disabled={!ready || recordingBusy || state.authenticationPaused} onClick={() => void controlRecording(paused ? 'resume' : 'pause')}>{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? 'Resume' : 'Pause'}</button><button className="stop-recording" disabled={!ready || recordingBusy} onClick={() => void controlRecording('stop')}><Square size={12} fill="currentColor" />Stop recording</button></>}{recordingStatus?.secretSync && recordingStatus.secretSync !== 'none' && <p role="status">{recordingStatus.secretSync === 'saved' ? 'Inputs and passwords saved in backend · reused automatically' : recordingStatus.secretSync === 'pending' ? 'Saving inputs to backend…' : 'Inputs saved locally. Backend sync failed.'}{recordingStatus.secretSync === 'failed' && <button className="text-button" disabled={recordingBusy} onClick={() => { setRecordingBusy(true); void browser?.syncSecrets(token.current).then(setRecordingStatus).catch(reason => setError(String(reason))).finally(() => setRecordingBusy(false)) }}>Retry input sync</button>}</p>}<p>{recordingStatus?.error ? 'Saving failed — check Console' : `${recordingStatus?.eventCount ?? 0} events · saved locally · login inputs encrypted`}</p></footer></section>
      </div>
    </main>
    {replay?.state === 'needs-user-approval' && <DashboardDialog title="Approve recorded action" onClose={() => void browser?.replayApprove(token.current, replay.sequence!, false)}><p className="modal-copy">Action {replay.sequence}: {replay.action}. This action may submit, send, or change website data. Approve this action once, or stop the test. No automatic retry will occur.</p><button className="dash-button dash-button--primary" onClick={() => void browser?.replayApprove(token.current, replay.sequence!, true)}>Approve this action</button><button className="dash-button" onClick={() => void browser?.replayApprove(token.current, replay.sequence!, false)}>Stop test</button></DashboardDialog>}
    {showResults && replay && <ReplaySummary run={replay} browser={browser} token={token.current} onClose={() => setShowResults(false)} />}
    {preview && <DashboardDialog title="Test this recording" onClose={() => setPreview(null)}><p className="modal-copy">Replay {preview.steps} actions from {preview.startURL}. Recorded login inputs are filled automatically.</p><p className="modal-copy">This repeats real website actions, including submitting forms, sending messages, or changing data. Start test authorizes these recorded actions for this run.</p><p className="modal-copy" role="status">{preview.inputSource === 'backend' ? 'Saved inputs and passwords loaded from the server. They will be filled automatically.' : 'Server unavailable. Using the saved inputs and passwords on this device.'}</p>{preview.notes?.map(note => <p className="modal-copy" key={note}>{note}</p>)}{preview.blockers.map(blocker => <p className="modal-copy" role="alert" key={blocker}>{blocker}</p>)}{preview.blockers.length > 0 && <button className="dash-button dash-button--primary" disabled={recordingBusy} onClick={() => void startCleanRecording()}>Start clean recording on current page</button>}<button className="dash-button dash-button--primary" disabled={preview.blockers.length > 0} onClick={() => void startReplay()}>Start test · Fast</button><button className="dash-button" disabled={preview.blockers.length > 0} onClick={() => void startReplay('demo')}>Demo replay · Slow + highlights</button><p className="modal-copy">Demo replay pauses at each target and shows where actions happen. Both modes execute the same real actions.</p><button className="dash-button" onClick={() => setPreview(null)}>Cancel</button></DashboardDialog>}
    {inspectedEvent && <DashboardDialog title={eventLabel(inspectedEvent).label} onClose={() => setInspectedEvent(null)}><p className="modal-copy">Event {inspectedEvent.sequence} · {inspectedEvent.timestamp}</p><pre className="recording-event-json">{JSON.stringify(inspectedEvent, null, 2)}</pre></DashboardDialog>}
    {help && <DashboardDialog title="Record the complete browser process" onClose={() => setHelp(false)}><p className="modal-copy">Enter a website address or a Google search, then use Back, Forward, and Reload as you would in a browser. Follow the instructions on the left and mark them complete yourself.</p><p className="modal-copy">Record sign-in and the dashboard task together. Passwords and passcodes are encrypted locally and decrypted automatically during replay. Downloads are saved in the session’s downloads folder; wait for completion before stopping. Actions save automatically on this computer with selectors, coordinates, element details, timing, and page context. Pause suspends capture. Stop finishes the recording and lets you export all events. Passwords and passcodes are encrypted locally; other sensitive fields are masked. Supported embedded frames are captured, including cross-origin frames. Ambiguous frames and closed shadow roots remain unsupported. After stopping, use Test recording to replay supported actions. Masked inputs and drag gestures cannot be replayed yet.</p></DashboardDialog>}
  </div>
}
