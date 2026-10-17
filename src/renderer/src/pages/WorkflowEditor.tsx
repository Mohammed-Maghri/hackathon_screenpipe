import { WorkflowEvidence } from '../components/WorkflowEvidence'
import { evidenceSchema } from '../../../shared/screenpipeDiscovery'
import { browserInstructions } from '../../../shared/browserInstructions'
import { Database } from 'lucide-react'
import { DataProcessingInspector } from '../components/DataProcessingInspector'
import { defaultProcessing, operations, validateProcessing, type DataGraph, type ProcessingConfig, type ProcessingEvent, type DataFile } from '../../../shared/dataProcessing'
import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, CircleDot, Clock3, Code2, Copy, Download, Expand, Hand, Map, Minus, MoreHorizontal, MousePointer2, Pencil, Play, Plus, Search, Share, Trash2, Workflow as WorkflowIcon } from '../components/ImageIcon'
import { workflowPayload } from '../data/workflowPayload'
import { rememberDraftEdit, saveWorkflowDraft } from '../data/workflowDrafts'
import { cacheBackendWorkflow } from '../data/workflowStore'
import { savedEditorNodes } from '../data/savedEditorNodes'
import { NodeDataContract } from '../components/NodeDataContract'
import { GhostLogo } from '../components/GhostLogo'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { AppMark } from '../components/AppMark'
import { DashboardDialog } from '../components/DashboardDialog'
import { CanvasAddMenu } from '../components/CanvasAddMenu'
import { ToolbarTooltip } from '../components/ToolbarTooltip'
import { WorkflowConnectionForm } from '../components/WorkflowConnectionForm'
import { type AppName } from '../data/workflows'
import { makeNodes, edges, editorSnapshots, type EditorNode, type NodeStatus } from '../data/editorState'
import { useWorkflows } from '../data/workflowStore'
import '../styles/workflow-editor.css'

type Log = { status?: ProcessingEvent['status']; files?: DataFile[]; action: string; detail: string; app?: AppName; time: string }
export function WorkflowEditor({ backendWorkflow }: { backendWorkflow?: import('../../../shared/discovery').SavedWorkflowDetail } = {}) {
  const { id } = useParams()
  const workflows = useWorkflows()
  const navigate = useNavigate()
  const workflow = workflows.find(item => item.id === id)
  const [nodes, setNodes] = useState<EditorNode[]>(() => editorSnapshots.get(id ?? '')?.nodes ?? (workflow ? makeNodes(workflow) : []))
  const [title, setTitle] = useState(editorSnapshots.get(id ?? '')?.title ?? workflow?.name ?? 'Workflow not found')
  const [editingTitle, setEditingTitle] = useState(false)
  const [selectedId, setSelectedId] = useState(workflow?.id === 'orders' ? 'slack' : 'step-0')
  const [tab, setTab] = useState('Canvas')
  const [inspectorTab, setInspectorTab] = useState('Node')
  const [logTab, setLogTab] = useState('Run log')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [panMode, setPanMode] = useState(false)
  const [panning, setPanning] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [minimap, setMinimap] = useState(true)
  const [notice, setNotice] = useState('')
  const [dialog, setDialog] = useState<string | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [logsCleared, setLogsCleared] = useState(false)
  // A cleared view must not be repopulated by a pending run's completion.
  const logRevision = useRef(0)
  const pendingRunRevision = useRef<number | null>(null)
  const [processingStatus, setProcessingStatus] = useState<Record<string, ProcessingEvent>>({})
  useEffect(() => window.ghost?.processing.onStatus(event => {
    if (event.workflowId !== id || (pendingRunRevision.current !== null && pendingRunRevision.current !== logRevision.current)) return
    setProcessingStatus(current => ({ ...current, [event.nodeId]: event }))
  }), [id])
  const [saved, setSaved] = useState(false)
  const [defining, setDefining] = useState(false)
  const [writing, setWriting] = useState(false)
  const [running, setRunning] = useState(false)
  const saving = writing || running
  const [savedBoard, setSavedBoard] = useState(() => backendWorkflow ? JSON.stringify({ title: backendWorkflow.name, nodes: savedEditorNodes(backendWorkflow), connections: backendWorkflow.edges.map(edge => [edge.sourceNodeId, edge.targetNodeId]) }) : '')
  const [saveError, setSaveError] = useState('')
  const saveJobs = useRef(0)
  const failedSave = useRef('')
  const edgeIds = useRef(new globalThis.Map<string, string>())
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; x: number; y: number; nx: number; ny: number } | null>(null)
  const didDrag = useRef(false)
  const nodeHelpId = useId()
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const view = useRef({ zoom, offset })
  view.current = { zoom, offset }
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const selected = nodes.find(node => node.id === selectedId)
  const selectedSource = backendWorkflow?.nodes.find(node => node.id === selectedId)?.config
  const selectedEvidence = (Array.isArray(selectedSource?.evidence) ? selectedSource.evidence : []).flatMap(value => { const parsed = evidenceSchema.safeParse(value); return parsed.success ? [parsed.data] : [] })
  const selectedMissing = (Array.isArray(selectedSource?.missingInformation) ? selectedSource.missingInformation : []).filter((value): value is string => typeof value === 'string')
  const runningNode = nodes.find(node => processingStatus[node.id]?.status === 'RUNNING')
  const scale = zoom
  const [connections, setConnections] = useState<string[][]>(() => editorSnapshots.get(id ?? '')?.connections ?? (backendWorkflow ? backendWorkflow.edges.map(edge => [edge.sourceNodeId, edge.targetNodeId]) : workflow?.id === 'orders' ? edges : nodes.slice(1).map((node, index) => [nodes[index].id, node.id])))
  const processingGraph = (items = nodes): DataGraph => ({ nodes: items.map(n => ({ id: n.id, config: { stepType: n.kind === 'Data Processing' ? 'data_processing' : n.kind === 'Browser action' ? 'browser' : 'integration', ...(n.kind === 'Data Processing' ? { dataProcessing: n.processing ?? defaultProcessing() } : {}) } })), edges: connections.filter(([a,b]) => items.some(n => n.id === a) && items.some(n => n.id === b)).map(([sourceNodeId, targetNodeId]) => ({ sourceNodeId, targetNodeId })) })
  const activeEdges = connections.filter(([from, to]) => nodes.some(node => node.id === from) && nodes.some(node => node.id === to))
  const needsAttention = nodes.some(node => !['Ready', 'Learned'].includes(node.status))
  const learningNodeIds = JSON.stringify(nodes.filter(node => node.kind === 'Browser action').map(node => node.id))
  useEffect(() => {
    if (!id || !window.ghost?.browser) return
    let disposed = false
    void window.ghost.browser.learnedSteps(id, JSON.parse(learningNodeIds)).then(results => {
      if (disposed) return
      setNodes(current => current.map(node => {
        const result = results.find(item => item.nodeId === node.id)
        if (!result) return node
        // Saved recordings are authoritative for learned states, including after restart.
        return result.status !== 'Needs teaching' || ['Learned', 'Recorded'].includes(node.status) ? { ...node, status: result.status } : node
      }))
    }).catch(() => { if (!disposed) setNotice('Unable to load saved learning status. Please reopen this workflow to retry.') })
    return () => { disposed = true }
  }, [id, learningNodeIds])
  const boardSignature = JSON.stringify({ title, nodes, connections })
  const autosaveDraft = backendWorkflow?.status === 'DRAFT'
  const savedBoardRef = useRef(savedBoard)
  savedBoardRef.current = savedBoard
  useEffect(() => {
    if (backendWorkflow) setSavedBoard(JSON.stringify({ title: backendWorkflow.name, nodes: savedEditorNodes(backendWorkflow), connections: backendWorkflow.edges.map(edge => [edge.sourceNodeId, edge.targetNodeId]) }))
  }, [backendWorkflow])
  async function saveBoard(items = nodes, quiet = false) {
    if (!backendWorkflow || !window.ghost || (saving && !autosaveDraft)) return false
    const signature = JSON.stringify({ title, nodes: items, connections })
    const update = workflowPayload(backendWorkflow, title, items, connections, edgeIds.current)
    if (autosaveDraft) rememberDraftEdit(backendWorkflow.id, update)
    saveJobs.current++; setWriting(true)
    try {
      const result = autosaveDraft ? await saveWorkflowDraft(backendWorkflow.id, update) : await window.ghost.updateWorkflow(backendWorkflow.id, update)
      if (result.ok) {
        failedSave.current = ''; setSaveError(''); setSavedBoard(signature)
        cacheBackendWorkflow(result.workflow)
        if (!quiet) setNotice('Workflow saved to the backend.')
        return true
      }
      failedSave.current = signature; setSaveError(result.error)
      if (!quiet) setNotice(result.error)
    } catch {
      failedSave.current = signature; setSaveError('Unable to save workflow. Your edits are still on this board. Retry saving.')
    } finally { if (--saveJobs.current === 0) setWriting(false) }
    return false
  }
  const saveLatest = useRef(saveBoard)
  saveLatest.current = saveBoard
  const currentBoard = useRef({ nodes, signature: boardSignature })
  currentBoard.current = { nodes, signature: boardSignature }
  useEffect(() => {
    if (!autosaveDraft || !backendWorkflow || boardSignature === savedBoard) return
    if (!rememberDraftEdit(backendWorkflow.id, workflowPayload(backendWorkflow, title, nodes, connections, edgeIds.current))) setSaveError('Local recovery is unavailable. Keep this draft open until it is saved to the backend.')
    if (editingTitle || failedSave.current === boardSignature) return
    const timer = window.setTimeout(() => { void saveLatest.current(undefined, true) }, 500)
    return () => window.clearTimeout(timer)
  }, [autosaveDraft, backendWorkflow, boardSignature, savedBoard, editingTitle])
  useEffect(() => {
    if (!autosaveDraft) return
    const flush = () => {
      if (currentBoard.current.signature !== savedBoardRef.current && currentBoard.current.signature !== failedSave.current) void saveLatest.current(currentBoard.current.nodes, true)
    }
    window.addEventListener('beforeunload', flush)
    return () => { window.removeEventListener('beforeunload', flush); flush() }
  }, [autosaveDraft])
  async function defineContracts() {
    if (!backendWorkflow || !window.ghost || defining || saving) return
    setDefining(true)
    try {
      if (savedBoard !== boardSignature && !await saveBoard()) return
      const result = await window.ghost.defineWorkflowContracts(backendWorkflow.id)
      if (!result.ok) { setNotice(result.error); return }
      const next = savedEditorNodes(result.workflow)
      const nextConnections = result.workflow.edges.map(edge => [edge.sourceNodeId, edge.targetNodeId])
      setNodes(next); setTitle(result.workflow.name); setConnections(nextConnections)
      editorSnapshots.set(result.workflow.id, { nodes: next, title: result.workflow.name, connections: nextConnections })
      setSavedBoard(JSON.stringify({ title: result.workflow.name, nodes: next, connections: nextConnections }))
      setNotice('Inputs, outputs and validation saved for this workflow.')
    } catch { setNotice('Unable to define inputs and outputs. Your workflow is unchanged.') }
    finally { setDefining(false) }
  }
  function fitCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const current = nodesRef.current
    const left = current.length ? Math.min(...current.map(node => node.x)) : 0
    const top = current.length ? Math.min(...current.map(node => node.y)) : 0
    const right = current.length ? Math.max(...current.map(node => node.x + 220)) : 1000
    const bottom = current.length ? Math.max(...current.map(node => node.y + 155)) : 590
    const nextZoom = Math.max(.2, Math.min(1.6, (canvas.clientWidth - 150) / (right - left), (canvas.clientHeight - 140) / (bottom - top)))
    setZoom(nextZoom)
    setOffset({ x: (canvas.clientWidth - (right - left) * nextZoom) / 2 - left * nextZoom, y: (canvas.clientHeight - (bottom - top) * nextZoom) / 2 - top * nextZoom })
  }
  function zoomAt(nextZoom: number, x?: number, y?: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const current = view.current
    const next = Math.max(.2, Math.min(2.5, nextZoom))
    const cx = x ?? canvas.clientWidth / 2
    const cy = y ?? canvas.clientHeight / 2
    const nextOffset = { x: cx - (cx - current.offset.x) * next / current.zoom, y: cy - (cy - current.offset.y) * next / current.zoom }
    view.current = { zoom: next, offset: nextOffset }
    setOffset(nextOffset); setZoom(next)
  }
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => fitCanvas())
    observer.observe(canvas)
    function wheel(event: WheelEvent) {
      event.preventDefault()
      const bounds = canvas!.getBoundingClientRect()
      if (event.ctrlKey || event.metaKey) zoomAt(view.current.zoom * Math.exp(-event.deltaY * .005), event.clientX - bounds.left, event.clientY - bounds.top)
      else { const next = { x: view.current.offset.x - event.deltaX, y: view.current.offset.y - event.deltaY }; view.current.offset = next; setOffset(next) }
    }
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => { observer.disconnect(); canvas.removeEventListener('wheel', wheel) }
  }, [tab])
  useEffect(() => { if (id && workflow) editorSnapshots.set(id, { nodes, title, connections }) }, [id, workflow, nodes, title, connections])
  const startingRecording = useRef(false)
  async function teachNode(nodeId: string, fresh = false) {
    if (startingRecording.current || saving) return
    const node = nodes.find(item => item.id === nodeId)
    if (!node || node.kind !== 'Browser action') return
    if (node.startUrl) {
      try { const url = new URL(node.startUrl); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error() }
      catch { setNotice('Enter a complete HTTP or HTTPS dashboard URL without embedded credentials.'); return }
    }
    startingRecording.current = true
    try {
      // The recording route reloads from the backend; persist edits before leaving.
      if (backendWorkflow && !await saveBoard()) return
      if (id) editorSnapshots.set(id, { nodes, title, connections })
      navigate(`/workflows/${id}/record/${nodeId}`, { state: { fresh } })
    } finally { startingRecording.current = false }
  }
  function openNode(nodeId: string) { setSelectedId(nodeId); setInspectorTab('Node'); setDialog('Node details') }
  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return
    if ((event.target as HTMLElement).closest('.canvas-toolbar, .canvas-view-controls, .canvas-minimap, .canvas-hint')) return
    if (!panMode && event.button !== 1 && (event.target as HTMLElement).closest('.canvas-node')) return
    event.preventDefault()
    pan.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
    setPanning(true); event.currentTarget.setPointerCapture(event.pointerId)
  }
  function movePan(event: PointerEvent<HTMLDivElement>) {
    if (!pan.current) return
    setOffset({ x: pan.current.ox + event.clientX - pan.current.x, y: pan.current.oy + event.clientY - pan.current.y })
  }

  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 4000); return () => window.clearTimeout(timer) }, [notice])
  function updateNode(patch: Partial<EditorNode>) { setNodes(current => current.map(node => node.id === selectedId ? { ...node, ...patch, ...(node.kind === 'Browser action' && 'startUrl' in patch ? { instructions: browserInstructions(patch.instructions ?? node.instructions, patch.startUrl) } : {}) } : node)); setSaved(false) }
  function moveNode(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return
    const start = drag.current
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 4 && !didDrag.current) return
    didDrag.current = true
    setNodes(current => current.map(node => node.id === start.id ? { ...node, x: start.nx + (event.clientX - start.x) / scale, y: start.ny + (event.clientY - start.y) / scale } : node))
    setSaved(false)
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ name: title, description: workflow?.description, steps: nodes.filter(node => node.id !== 'trigger' && node.kind !== 'Trigger').map(node => node.description), nodes }, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`; anchor.click(); URL.revokeObjectURL(url); setSaved(true); setNotice('Workflow exported as JSON.')
  }
  function clearRunResults() {
    logRevision.current++
    setLogs([]); setProcessingStatus({}); setLogsCleared(true); setLogOpen(true)
    setNotice('Run logs and test results cleared.')
  }
  function testRun() { logRevision.current++; setLogsCleared(false); setProcessingStatus({}); setLogOpen(true); setLogs(nodes.map(node => ({ action: node.title, detail: ['Ready', 'Learned'].includes(node.status) ? 'Step validated for preview' : node.status, app: node.app, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }))); setLogTab('Test results'); setNotice('Preview validation complete. No apps were opened or actions executed.') }
  function addNode(kind = 'Browser action') {
    const nodeId = crypto.randomUUID(), previous = selected ?? nodes.at(-1)
    setNodes(current => [...current, { id: nodeId, title: kind === 'Data Processing' ? 'Process data' : 'New action', kind, description: kind === 'Data Processing' ? '' : 'Configure this step.', status: kind === 'Browser action' ? 'Needs teaching' : 'Needs configuration', instructions: [], ...(kind === 'Data Processing' ? { processing: { ...defaultProcessing(), mode: 'generated' as const, inferOutput: true, expectedOutput: { format: 'rows' as const, filename: null } } } : {}), x: (previous?.x ?? 150) + 280, y: previous?.y ?? 240 }])
    if (previous) setConnections(current => [...current, [previous.id, nodeId]])
    openNode(nodeId); setSaved(false)
  }
  async function saveProcessing(config: ProcessingConfig) {
    const items = nodes.map(n => n.id === selectedId ? { ...n, processing: config } : n)
    const errors = validateProcessing(processingGraph(items), selectedId)
    const next = items.map(n => n.id === selectedId ? { ...n, status: (errors.length || config.mode === 'generated' && (!config.approvedPlan || n.status !== 'Ready') ? 'Needs configuration' : 'Ready') as NodeStatus } : n)
    setNodes(next)
    if (!backendWorkflow) { if (id) editorSnapshots.set(id, { nodes: next, title, connections }); setNotice('Saved in this local preview.'); return true }
    return saveBoard(next)
  }
  async function runProcessing() {
    if (!id || !window.ghost || saving) return
    if (backendWorkflow && savedBoard !== boardSignature && !await saveBoard()) return
    const needsLogic = nodes.find(n => n.kind === 'Data Processing' && n.processing?.mode === 'generated' && (!n.processing.approvedPlan || n.status !== 'Ready'))
    if (needsLogic) { openNode(needsLogic.id); setNotice('Enter a prompt and run this node once to save its processing logic for the pipeline.'); return }
    const revision = ++logRevision.current
    pendingRunRevision.current = revision
    setLogsCleared(false); setProcessingStatus({}); setLogTab('Run log')
    setRunning(true); setLogOpen(true); setDialog(null); setNotice('Running local processing from saved browser downloads…')
    try {
      const results = await window.ghost.processing.run({ workflowId: id, graph: processingGraph() })
      if (revision !== logRevision.current) return
      setLogs(results.map(r => ({ action: nodes.find(n => n.id === r.nodeId)?.title ?? r.nodeId, status: r.status, files: Object.values(r.outputs).flatMap(value => value.type === 'files' ? value.value : []), detail: r.error ?? `${r.status} · ${Object.entries(r.outputs).map(([key, value]) => `${key}: ${Array.isArray(value.value) ? value.value.length : value.value}`).join(', ')}`, time: new Date().toLocaleTimeString() })))
      setNotice(results.some(r => r.status !== 'VERIFIED') ? 'Processing stopped with errors. See the run log.' : 'Local processing verified. Generated reports are available in the run log.')
    } catch (e) { if (revision === logRevision.current) setNotice(String(e)) }
    finally { pendingRunRevision.current = null; setRunning(false) }
  }

  if (!workflow) return <div className="editor-not-found grid h-full min-w-0 flex-1 place-content-center gap-6 bg-canvas p-8 text-center text-ink [&>h1]:text-2xl [&>h1]:font-medium [&>h1]:tracking-tight"><GhostLogo /><h1>Workflow not found.</h1><button className="dash-button" onClick={() => navigate('/dashboard')}>Back to dashboard</button></div>
  const description = workflow.id === 'orders' ? 'Collect daily orders from Slack, check the dashboard, and generate an Excel report.' : workflow.description
  return <div className="editor-shell absolute inset-0 flex overflow-hidden bg-panel font-sans text-sm leading-6 text-ink" data-page="workflow-editor" inert={defining} aria-busy={defining}>
    <WorkflowSidebar />

    <main className="editor-main flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="editor-header grid shrink-0 grid-cols-[minmax(240px,1fr)_auto] grid-rows-[auto_auto_auto_auto] gap-x-6 bg-panel px-7 pt-6 max-[1320px]:grid-cols-1 max-[1320px]:px-6 max-[1320px]:pt-5 max-[761px]:px-4 max-[761px]:pt-3.5 min-[1600px]:px-9 min-[1600px]:pt-7"><div className="editor-breadcrumb font-mono col-start-1 row-start-1 mb-3 flex min-w-0 items-center gap-2 text-xs text-muted [&>button]:flex [&>button]:shrink-0 [&>button]:items-center [&>button]:gap-2 [&>button]:hover:text-action [&>span]:truncate"><button onClick={() => navigate('/workflows')}><ArrowLeft size={14} />Workflows</button><ChevronRight size={13} /><span>{title}</span></div><div className="editor-actions font-mono col-start-2 row-span-3 row-start-1 flex max-w-[580px] flex-wrap items-center justify-end gap-2 self-center max-[1320px]:col-start-1 max-[1320px]:row-span-1 max-[1320px]:row-start-4 max-[1320px]:mb-4 max-[1320px]:max-w-none max-[1320px]:justify-start [&_.dash-button]:min-h-9 [&_.dash-button]:px-3 [&_.dash-button]:text-xs [&_.dash-button]:whitespace-nowrap max-[761px]:gap-1.5 max-[761px]:[&_.dash-button]:min-h-9 max-[761px]:[&_.dash-button]:px-2.5 max-[761px]:[&_.dash-button]:text-xs">{backendWorkflow && <button className="dash-button" disabled={defining || saving || nodes.some(n => n.kind === 'Data Processing')} title={nodes.some(n => n.kind === 'Data Processing') ? 'Data Processing operations define their own typed contracts.' : undefined} onClick={() => void defineContracts()}>{defining ? 'Defining inputs…' : 'Define inputs & outputs'}</button>}{backendWorkflow && <button className="dash-button" disabled={saving || savedBoard === boardSignature} onClick={() => void saveBoard()}>{saving ? 'Saving…' : saveError ? 'Retry save' : 'Save changes'}</button>}<button className="dash-button" onClick={() => setDialog('Share workflow')}><Share size={15} />Share</button><button className="dash-button" onClick={testRun}><Play size={15} />Test run</button><div className="run-button-group flex [&>.dash-button:first-child]:min-w-20 [&>.dash-button:first-child]:rounded-r-none [&>.dash-button:last-child]:rounded-l-none [&>.dash-button:last-child]:border-l-on-action/25 [&>.dash-button:last-child]:px-2.5"><button className="dash-button dash-button--primary" onClick={() => setDialog('Run workflow')}><Play size={15} fill="currentColor" />Run</button><button className="dash-button dash-button--primary" aria-label="Run options" onClick={() => setDialog('Run options')}><ChevronDown size={15} /></button></div><button className="dash-button more-editor w-10 !px-0" aria-label="Workflow options" onClick={() => setDialog('Workflow options')}><MoreHorizontal size={18} /></button></div>
      <div className="editor-title-row col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-2.5 [&>h1]:m-0 [&>h1]:flex [&>h1]:min-w-0 [&>h1]:items-center [&>h1]:gap-3 [&>h1]:text-2xl [&>h1]:leading-tight [&>h1]:font-medium [&>h1]:tracking-tight [&>h1]:break-words [&>h1>button]:grid [&>h1>button]:size-8 [&>h1>button]:shrink-0 [&>h1>button]:place-items-center [&>h1>button]:rounded-control [&>h1>button]:text-muted [&>h1>button]:hover:bg-sunken [&>h1>button]:hover:text-ink max-[761px]:[&>h1]:text-xl">{editingTitle ? <input className="editor-title-input w-full max-w-md min-w-0 rounded-control border border-action bg-panel px-2.5 py-1.5 font-mono text-xl leading-tight font-medium tracking-tight text-ink" aria-label="Workflow name" value={title} onChange={event => { setTitle(event.target.value); setSaved(false) }} onBlur={() => { setTitle(title.trim() || workflow.name); setEditingTitle(false) }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} autoFocus /> : <h1>{title}<button aria-label="Rename workflow" onClick={() => setEditingTitle(true)}><Pencil size={15} /></button></h1>}<button onClick={() => { const node = nodes.find(item => item.status === 'Needs teaching'); if (node) teachNode(node.id) }} className={`node-status font-mono inline-flex w-max max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs leading-4 font-normal whitespace-nowrap ${needsAttention ? 'needs-attention bg-peach text-warning' : 'is-ready bg-mint text-success'}`}><CircleDot size={12} />{needsAttention ? nodes.some(node => node.status === 'Needs teaching') ? 'Needs teaching' : nodes.some(node => node.status === 'Recorded') ? 'Needs testing' : 'Needs configuration' : nodes.some(node => node.status === 'Learned') ? 'Learned' : 'Ready'}</button><span role="status" className="editor-save-state font-mono text-xs whitespace-nowrap text-muted">{backendWorkflow ? saveError ? 'Changes not saved' : writing ? 'Saving…' : savedBoard === boardSignature ? 'Saved to backend' : autosaveDraft ? 'Autosave pending…' : 'Unsaved changes' : saved ? 'Exported' : 'Local preview · unsaved'}</span></div>{description && <details className="editor-description group/description col-start-1 row-start-3 mt-1 mb-3 min-w-0">
        <summary aria-controls="workflow-description" className="text-button min-h-7 w-fit list-none rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action [&::-webkit-details-marker]:hidden"><ChevronRight size={13} aria-hidden="true" className="group-open/description:rotate-90" /><span className="group-open/description:hidden">Show description</span><span className="hidden group-open/description:inline">Hide description</span></summary>
        <p id="workflow-description" role="region" aria-label="Workflow description" tabIndex={0} className="mt-2 max-h-[min(8rem,18dvh)] overflow-y-auto overscroll-contain rounded-control border border-line bg-canvas px-3 py-2.5 text-sm leading-6 whitespace-pre-wrap text-muted [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action max-[761px]:text-xs">{description}</p>
      </details>}
      <nav className="editor-tabs col-span-full row-start-4 flex items-center gap-1 overflow-x-auto pb-3 max-[1320px]:row-start-5 [&>button]:rounded-control [&>button]:px-4 [&>button]:py-2.5 [&>button]:text-sm [&>button]:whitespace-nowrap [&>button]:text-muted [&>button]:hover:bg-canvas [&>button]:hover:text-ink [&>button.is-active]:bg-sunken [&>button.is-active]:font-medium [&>button.is-active]:text-ink max-[761px]:[&>button]:px-3 max-[761px]:[&>button]:py-2 max-[761px]:[&>button]:text-xs [&>button]:font-mono [&>button]:text-xs" aria-label="Workflow views">{['Canvas', 'Steps', 'Runs', 'Activity', 'Settings'].map(item => <button key={item} className={tab === item ? 'is-active' : ''} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}>{item}</button>)}</nav></header>
      {saveError && <div role="alert" className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line bg-panel px-7 py-3 text-xs text-danger"><p className="min-w-0 flex-1">{saveError}</p><button className="dash-button" disabled={saving} onClick={() => void saveBoard()}>Retry save</button></div>}
      <div className="editor-workspace flex min-h-0 flex-1 border-t border-line"><div className="editor-center flex min-h-0 min-w-0 flex-1 flex-col">
        {tab === 'Canvas' ? <div className={`workflow-canvas relative isolate min-h-44 flex-1 touch-none cursor-grab overflow-hidden bg-canvas [&.is-panning]:cursor-grabbing [&.is-pan-mode_.canvas-node]:cursor-grabbing ${panMode ? 'is-pan-mode' : ''} ${panning ? 'is-panning' : ''}`} ref={canvasRef} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={() => { pan.current = null; setPanning(false) }} onPointerCancel={() => { pan.current = null; setPanning(false) }}>
          <div className="canvas-toolbar absolute top-5 left-5 z-4 grid cursor-default gap-1 rounded-control border border-line bg-panel p-1.5  [&_.canvas-tool>button]:grid [&_.canvas-tool>button]:size-9 [&_.canvas-tool>button]:place-items-center [&_.canvas-tool>button]:rounded-control [&_.canvas-tool>button]:text-muted [&_.canvas-tool>button.is-active]:bg-action-soft [&_.canvas-tool>button.is-active]:text-action [&_.canvas-tool>button]:hover:bg-action-soft [&_.canvas-tool>button]:hover:text-action [&_.canvas-tool>button]:disabled:cursor-not-allowed [&_.canvas-tool>button]:disabled:opacity-40 max-[760px]:top-3 max-[760px]:left-3 max-[760px]:p-1 max-[760px]:[&_.canvas-tool>button]:size-8" aria-label="Canvas tools">
            <ToolbarTooltip label="Select and move nodes"><button className={!panMode ? 'is-active' : ''} aria-label="Select and move nodes" aria-pressed={!panMode} onClick={() => setPanMode(false)}><MousePointer2 size={19} fill="currentColor" /></button></ToolbarTooltip>
            <ToolbarTooltip label="Pan canvas"><button className={panMode ? 'is-active' : ''} aria-label="Pan canvas" aria-pressed={panMode} onClick={() => setPanMode(true)}><Hand size={19} /></button></ToolbarTooltip>
            <CanvasAddMenu onChoose={setDialog} />
            <ToolbarTooltip label={selected ? 'Duplicate selected node' : 'Select a node to duplicate'}><button aria-label="Duplicate selected node" disabled={!selected} onClick={() => { if (!selected) return; const nodeId = crypto.randomUUID(); setNodes(current => [...current, { ...selected, id: nodeId, title: `${selected.title} copy`, x: selected.x + 40, y: selected.y + 150 }]); setSelectedId(nodeId); setSaved(false) }}><Copy size={18} /></button></ToolbarTooltip>
            <ToolbarTooltip label={selected ? 'Delete selected node' : 'Select a node to delete'}><button aria-label="Delete selected node" disabled={!selected} onClick={() => setDialog('Delete node')}><Trash2 size={18} /></button></ToolbarTooltip>
            <ToolbarTooltip label="Search workflow steps"><button aria-label="Search steps" onClick={() => setTab('Steps')}><Search size={18} /></button></ToolbarTooltip>
            <ToolbarTooltip label="Canvas help and controls"><button aria-label="Canvas options" onClick={() => setDialog('Canvas controls')}><MoreHorizontal size={18} /></button></ToolbarTooltip>
          </div>
          <div className="canvas-view-controls absolute top-5 right-5 z-4 flex cursor-default gap-2 [&>div]:flex [&>div]:h-10 [&>div]:items-center [&>div]:rounded-control [&>div]:border [&>div]:border-line [&>div]:bg-panel  [&>button]:border [&>button]:border-line [&>button]:bg-panel  [&_button]:grid [&_button]:size-9.5 [&_button]:place-items-center [&_button]:rounded-control [&_button]:text-muted [&_button]:hover:bg-action-soft [&_button]:hover:text-action [&_span]:min-w-13 [&_span]:border-x [&_span]:border-line [&_span]:text-center [&_span]:text-xs [&_span]:text-ink [&_span]:tabular-nums max-[760px]:top-3 max-[760px]:right-3 max-[760px]:gap-1 [&_span]:font-mono"><div><button aria-label="Zoom out" onClick={() => zoomAt(zoom / 1.15)}><Minus size={15} /></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => zoomAt(zoom * 1.15)}><Plus size={15} /></button></div><button aria-label="Fit canvas" onClick={fitCanvas}><Expand size={17} /></button><button aria-label="Toggle minimap" aria-pressed={minimap} onClick={() => setMinimap(value => !value)}><Map size={17} /></button></div>
          <div className="canvas-world-wrap pointer-events-none absolute inset-0 min-w-0"><div className="canvas-world pointer-events-none relative h-[590px] w-[1000px] origin-top-left" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}><svg className="canvas-edges pointer-events-none absolute inset-0 h-[590px] w-[1000px] overflow-visible [&_path]:fill-none [&_path]:stroke-strong [&_path]:stroke-[1.6]" viewBox="0 0 1000 590" aria-hidden="true">{activeEdges.map(([from, to]) => { const a = nodes.find(node => node.id === from)!; const b = nodes.find(node => node.id === to)!; let x1 = a.x + (a.id === 'trigger' ? 180 : 210); let y1 = a.y + (a.id === 'trigger' ? 29 : 58); let x2 = b.x; let y2 = b.y + 48; let path: string
            if (from === 'dashboard' && to === 'process') { x2 = b.x + 150; y2 = b.y; const corner = Math.min(20, Math.abs(x2 - x1) / 2); path = `M ${x1} ${y1} H ${x2 - corner} Q ${x2} ${y1} ${x2} ${y1 + corner} V ${y2}` }
            else if (from === 'process' && to === 'excel') { x1 = a.x; y1 = a.y + 48; x2 = b.x + 195; y2 = b.y; path = `M ${x1} ${y1} H ${x2 + 20} Q ${x2} ${y1} ${x2} ${y1 + 20} V ${y2}` }
            else { const bend = Math.min(65, Math.abs(x2 - x1) / 2); path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}` }
            return <path key={`${from}-${to}`} d={path} /> })}</svg>
          {nodes.map(node => <button key={node.id} aria-pressed={node.id === selectedId} aria-describedby={nodeHelpId} data-run-state={processingStatus[node.id]?.status} title={`${node.title} · ${node.status} · Double-click to open settings`} className={`canvas-node font-sans pointer-events-auto absolute min-h-36 w-[210px] touch-none cursor-grab rounded-card border border-line bg-panel p-3.5 text-left text-ink  select-none transition-[border-color,box-shadow] duration-150 hover:border-strong  active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action [&.is-selected:not([data-run-state=RUNNING])]:border-action [&.is-selected]:ring-1 [&.is-selected]:ring-action-soft data-[run-state=RUNNING]:border-live data-[run-state=RUNNING]:ring-1 data-[run-state=RUNNING]:ring-live/20 motion-reduce:transition-none ${node.kind === 'Data Processing' ? 'data-processing-node' : ''} ${node.id === selectedId ? 'is-selected' : ''} ${(node.id === 'trigger' || node.kind === 'Trigger') ? 'trigger-node !min-h-[58px] !w-[180px] !px-2 !py-3' : ''} node-${node.id}`} style={{ left: node.x, top: node.y }} onClick={event => { if (!panMode && (!didDrag.current || event.detail === 0)) setSelectedId(node.id) }} onDoubleClick={() => { if (!panMode && !didDrag.current) openNode(node.id) }} onKeyDown={event => {
            if (event.key === 'Enter' && !panMode) { event.preventDefault(); openNode(node.id) }
          }} onPointerDown={event => { if (event.button !== 0 || panMode) return; event.stopPropagation(); didDrag.current = false; setSelectedId(node.id); drag.current = { id: node.id, x: event.clientX, y: event.clientY, nx: node.x, ny: node.y }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={moveNode} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}><span className="node-port absolute top-[41px] size-3.5 rounded-full border border-strong bg-panel [.is-selected_&]:border-action [.is-selected_&]:bg-action-soft node-port-in -left-2 [.trigger-node_&]:hidden [.node-process_&]:-top-2 [.node-process_&]:left-[143px] [.node-excel_&]:-top-2 [.node-excel_&]:left-[188px]" /><span className="node-heading flex items-center gap-2.5 [&_.app-mark]:size-7 [&_.app-mark]:shrink-0 [&_.app-mark]:rounded-control [&>span:nth-child(2)]:min-w-0 [&_strong]:block [&_strong]:truncate [&_strong]:text-sm [&_strong]:leading-5 [&_strong]:font-medium [&_small]:mt-0.5 [&_small]:block [&_small]:truncate [&_small]:text-xs [&_small]:leading-4 [&_small]:text-muted [&>svg]:hidden [&>.ui-image-icon]:hidden [&_small]:font-mono">{node.kind === 'Browser action' || (node.app && node.kind !== 'Data Processing') ? <AppMark app={node.kind === 'Browser action' ? 'Chrome' : node.app!} /> : <span className={`node-custom-icon grid size-7 shrink-0 place-items-center rounded-control border border-line bg-lilac text-lilac-ink [.data-processing-node_&]:bg-action-soft [.data-processing-node_&]:text-action ${(node.id === 'trigger' || node.kind === 'Trigger') ? 'trigger-icon !rounded-full !border-transparent !bg-mint !text-success' : ''}`}>{(node.id === 'trigger' || node.kind === 'Trigger') ? <Clock3 size={22} /> : node.kind === 'Data Processing' ? <Database size={23} /> : <Code2 size={23} />}</span>}<span><strong>{node.title}</strong><small>{node.kind === 'Data Processing' ? operations[node.processing?.operation ?? 'read_files'].label : node.kind}</small></span><MoreHorizontal size={16} /></span>{node.id !== 'trigger' && node.kind !== 'Trigger' && <><span className="node-description mt-2.5 mb-2 line-clamp-2 text-xs leading-4.5 text-muted">{node.description}</span>{node.kind === 'Data Processing' && <span className="node-data-types font-mono my-2.5 grid gap-1 text-left text-xs text-muted"><span>Input: {operations[node.processing?.operation ?? 'read_files'].inputs.map(p => p.type).join(', ')}</span><span>Output: {operations[node.processing?.operation ?? 'read_files'].outputs.map(p => p.type).join(', ')}</span></span>}<span className={`node-status font-mono inline-flex w-max max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs leading-4 font-normal whitespace-nowrap ${['Ready', 'Learned'].includes(node.status) ? 'is-ready bg-mint text-success' : 'needs-attention bg-peach text-warning'}`}><CircleDot size={11} />{node.status}</span>{processingStatus[node.id] && <span className={`node-run-status font-mono mt-2 block text-xs ${processingStatus[node.id].status === 'RUNNING' ? 'text-live' : processingStatus[node.id].status === 'FAILED' ? 'text-danger' : 'text-muted'}`} role="status">{processingStatus[node.id].status}</span>}</>}<span className="node-port absolute top-[41px] size-3.5 rounded-full border border-strong bg-panel [.is-selected_&]:border-action [.is-selected_&]:bg-action-soft node-port-out top-[51px] -right-2 [.trigger-node_&]:top-[22px] [.node-process_&]:top-[41px] [.node-process_&]:right-auto [.node-process_&]:-left-2" /></button>)}
          </div></div>
          {minimap && <button className="canvas-minimap absolute bottom-5 left-5 z-3 w-40 rounded-control border border-line bg-panel p-2  [&>svg]:h-18 [&>svg]:w-full [&_rect]:fill-sunken [&_rect]:stroke-strong [&_rect]:stroke-2 [&_rect.selected]:fill-action-soft [&_rect.selected]:stroke-action [&>span]:flex [&>span]:items-center [&>span]:border-t [&>span]:border-line [&>span]:pt-1.5 [&>span]:text-xs [&>span]:text-muted [&>span]:tabular-nums [&>span>svg]:ml-auto [&>span>svg]:size-3.5 max-[760px]:bottom-3 max-[760px]:left-3 max-[760px]:w-28 max-[760px]:[&>svg]:h-12 [&>span]:font-mono" aria-label="Reset canvas view" onClick={fitCanvas}><svg viewBox="0 0 1000 590" aria-hidden="true">{nodes.map(node => <rect key={node.id} x={node.x} y={node.y} width={(node.id === 'trigger' || node.kind === 'Trigger') ? 180 : 210} height={(node.id === 'trigger' || node.kind === 'Trigger') ? 58 : 130} className={node.id === selectedId ? 'selected' : ''} />)}<rect className="minimap-viewport !fill-none !stroke-muted !stroke-3" x="55" y="55" width="910" height="500" /></svg><span>{nodes.length} nodes&nbsp; {activeEdges.length} edges <Expand size={13} /></span></button>}
          <div className="canvas-hint font-mono pointer-events-none absolute right-5 bottom-5 flex max-w-[calc(100%-220px)] items-center gap-2.5 rounded-control border border-line bg-panel px-3 py-2 text-xs text-muted [&>span]:text-strong max-[1050px]:hidden">Drag to pan <span>·</span> Ctrl / ⌘ + scroll to zoom <span>·</span> Click to select <span>·</span> Double-click to edit</div>
          <p id={nodeHelpId} className="sr-only">Click or press Space to select a node. Double-click or press Enter to open node settings.</p>
        </div> : <section className="editor-tab-content min-h-0 flex-1 overflow-auto bg-canvas px-7 py-8 [&>h2]:m-0 [&>h2]:mb-3 [&>h2]:text-2xl [&>h2]:font-medium [&>h2]:tracking-tight [&>p]:mt-0 [&>p]:mb-6 [&>p]:max-w-3xl [&>p]:text-sm [&>p]:leading-6 [&>p]:text-muted [&_.editor-field]:max-w-xl max-[760px]:px-4 max-[760px]:py-6"><h2>{tab}</h2>{tab === 'Steps' && <><p>Select a step to edit its instructions in the popup.</p>{nodes.map((node, index) => <button className={`editor-step-row font-sans mb-2.5 flex min-h-18 w-full items-center gap-4 rounded-control border border-line bg-panel px-5 py-4 text-left transition-[border-color,box-shadow] duration-150 hover:border-strong  [&.is-selected]:border-action [&>strong]:mr-auto [&>strong]:text-sm [&>strong]:font-medium [&>strong]:text-ink [&>span:first-child]:grid [&>span:first-child]:size-7 [&>span:first-child]:shrink-0 [&>span:first-child]:place-items-center [&>span:first-child]:rounded-control [&>span:first-child]:bg-sunken [&>span:first-child]:text-xs [&>span:first-child]:text-muted [&>span:first-child]:tabular-nums max-[760px]:flex-wrap max-[760px]:gap-2.5 max-[760px]:p-3.5 motion-reduce:transition-none  [&>span:first-child]:font-mono ${node.id === selectedId ? 'is-selected' : ''}`} key={node.id} onClick={() => openNode(node.id)}><span>{index + 1}</span><strong>{node.title}</strong><span className={`node-status font-mono inline-flex w-max max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs leading-4 font-normal whitespace-nowrap ${['Ready', 'Learned'].includes(node.status) ? 'is-ready bg-mint text-success' : 'needs-attention bg-peach text-warning'}`}>{node.status}</span><ChevronRight size={15} /></button>)}<button className="dash-button" onClick={() => addNode()}><Plus size={15} />Add step</button></>}{(tab === 'Runs' || tab === 'Activity') && <><p>{logs.length ? logs.some(log => log.status) ? 'Latest local processing results.' : 'Latest local preview validation. No external actions were executed.' : 'No runs yet. Use Test run to validate the current steps locally.'}</p>{logs.map((log, index) => <div className="editor-history-row flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line py-4.5 text-sm text-muted [&>time]:tabular-nums [&>strong]:font-medium [&>strong]:text-ink [&>time]:font-mono" key={index}><Clock3 size={16} /><time>{log.time}</time><strong>{log.action}</strong><span>{log.detail}</span></div>)}</>}{tab === 'Settings' && <><p>{backendWorkflow ? 'Use Save changes to persist edits to the backend.' : 'Workflow changes stay in this page until you export them.'}</p><label className="editor-field font-mono my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted">Workflow name<input className="w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-mono text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50" value={title} onChange={event => { setTitle(event.target.value); setSaved(false) }} /></label><button className="dash-button dash-button--primary" onClick={download}><Download size={15} />Export workflow</button></>}</section>}
        <section className={`editor-log shrink-0 border-t border-line bg-panel [&.is-collapsed]:h-12 [&.is-expanded]:max-h-64 [&.is-expanded]:overflow-auto [&>header]:flex [&>header]:h-12 [&>header]:items-center [&>header]:gap-2 [&>header]:border-b [&>header]:border-line [&>header]:px-5 [&>header]:text-xs [&>header]:text-muted [&>header>div]:mr-auto [&>header>div]:flex [&>header>div]:h-full [&>header>div]:gap-5 [&>header>div>button]:border-b-2 [&>header>div>button]:border-transparent [&>header>div>button]:px-0.5 [&>header>div>button]:text-sm [&>header>div>button]:text-muted [&>header>div>button.is-active]:border-action [&>header>div>button.is-active]:text-action [&>header>.dash-button]:ml-2.5 [&>header>.dash-button]:min-h-8 [&>header>.dash-button]:px-2.5 [&>header>.dash-button]:py-1 [&>header>.dash-button]:text-xs max-[760px]:[&>header]:px-2.5 max-[760px]:[&>header>span]:hidden max-[760px]:[&.is-expanded]:max-h-48  [&>header]:font-mono [&>header>div>button]:text-xs ${logOpen ? 'is-expanded' : 'is-collapsed'}`}><header><button className="log-toggle grid h-8 w-7 place-items-center rounded-control text-muted hover:bg-sunken [.is-collapsed_&>svg]:rotate-180" aria-label={logOpen ? 'Collapse run log' : 'Expand run log'} aria-expanded={logOpen} onClick={() => setLogOpen(value => !value)}><ChevronDown size={16} /></button><div>{['Run log', 'Test results'].map(item => <button key={item} className={logTab === item ? 'is-active' : ''} onClick={() => { setLogTab(item); setLogOpen(true) }}>{item}</button>)}</div><span className={`log-preview-dot size-1.5 rounded-full ${runningNode || pendingRunRevision.current !== null ? 'bg-live' : 'bg-strong'}`} /> <span className={runningNode || pendingRunRevision.current !== null ? 'processing-run-label min-w-0 truncate text-live' : 'min-w-0 truncate'}>{runningNode ? `Running: ${runningNode.title}` : pendingRunRevision.current !== null ? 'Processing continues…' : logs.some(log => log.status) ? 'Local processing' : 'Local preview'}</span><button className="dash-button" aria-label="Clear run logs and test results" onClick={clearRunResults}><Trash2 size={13} />Clear logs</button></header>{logOpen && (logs.length ? <div className="log-rows px-5 pt-2 pb-4">{logs.map((log, index) => <div className="log-row font-mono grid min-h-11 grid-cols-[72px_20px_minmax(100px,160px)_minmax(0,1fr)_112px] items-start gap-3 border-b border-line py-2.5 text-xs leading-6 text-muted [&>time]:tabular-nums [&_.app-mark]:size-4.5 [&_.app-mark]:rounded [&>strong]:overflow-hidden [&>strong]:font-medium [&>strong]:text-ellipsis [&>strong]:text-ink [&>span]:min-w-0 [&>span]:break-words [&>span:last-child]:flex [&>span:last-child]:items-center [&>span:last-child]:gap-1.5 [&_.text-button]:mt-1 [&_.text-button]:block [&_.text-button]:text-xs max-[760px]:grid-cols-[60px_18px_minmax(0,1fr)_100px] max-[760px]:[&>span:nth-last-child(2)]:col-start-3 max-[760px]:[&>span:nth-last-child(2)]:col-end-5 max-[760px]:[&>span:nth-last-child(2)]:row-start-2 [&>strong]:font-sans" key={index}><time>{log.time}</time>{log.app ? <AppMark app={log.app} /> : <Clock3 size={14} />}<strong>{log.action}</strong><span>{log.detail}{log.files?.map(file => <button className="text-button" key={file.id} onClick={() => void window.ghost?.processing.reveal(id!, file.id).catch(error => setNotice(String(error)))}>{file.name}</button>)}</span><span className={log.status === 'RUNNING' ? 'log-running text-live' : log.status === 'FAILED' ? 'log-failed text-danger' : (log.status === 'VERIFIED' || log.detail.startsWith('Step')) ? 'log-success text-success' : 'log-warning text-warning'}><CircleDot size={11} />{log.status ?? (log.detail.startsWith('Step') ? 'Validated' : 'Needs review')}</span></div>)}</div> : <div className="log-empty flex flex-wrap items-center justify-center gap-4 px-6 py-8 text-muted [&>svg]:shrink-0 [&>p]:m-0 [&>p]:text-sm [&>p]:text-subtle [&>p>span]:mt-1.5 [&>p>span]:block [&>p>span]:text-xs [&>p>span]:text-muted"><WorkflowIcon size={21} /><p>{logsCleared ? 'Run logs and test results cleared.' : logTab === 'Run log' ? 'Your workflow’s run history will appear here.' : 'Test your workflow to check its steps.'}<span>{logsCleared ? pendingRunRevision.current !== null ? 'Processing is still running. Its results will stay cleared.' : 'Run again to see new results.' : 'Run a local preview to validate the steps without executing actions.'}</span></p><button className="text-button" onClick={testRun}>Test run <ArrowRight size={14} /></button></div>)}</section>
      </div>
      </div>
    </main>
    {notice && <div className="dashboard-toast" role="status"><Check size={16} />{notice}</div>}
    {dialog && <DashboardDialog title={dialog === 'Node details' ? (selected?.title ?? 'Node details') : dialog} className={dialog === 'Node details' ? 'node-details-dialog !w-[min(720px,calc(100vw-40px))] [&>.dashboard-dialog-inner]:px-8 [&>.dashboard-dialog-inner]:py-7 [&_h2]:mb-5 [&_h2]:pr-6 [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:tracking-tight max-[760px]:!w-[calc(100vw-24px)] max-[760px]:[&>.dashboard-dialog-inner]:px-5 max-[760px]:[&>.dashboard-dialog-inner]:py-6' : undefined} onClose={() => setDialog(null)}>
      {dialog === 'Node details' && selected?.kind === 'Data Processing' ? <DataProcessingInspector key={selected.id} node={selected} nodes={nodes} graph={processingGraph()} workflowId={id!} onChange={updateNode} onSave={saveProcessing} /> : dialog === 'Node details' ?       <div className="node-popup min-w-0 [&>nav]:flex [&>nav]:h-11 [&>nav]:gap-5 [&>nav]:border-b [&>nav]:border-line [&>nav>button]:min-w-18 [&>nav>button]:border-b-2 [&>nav>button]:border-transparent [&>nav>button]:text-sm [&>nav>button]:text-muted [&>nav>button]:hover:text-ink [&>nav>button.is-active]:border-action [&>nav>button.is-active]:text-action [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted [&_details]:border-y [&_details]:border-line [&_details]:py-3 [&_details]:text-sm [&_details]:text-muted [&_summary]:cursor-pointer [&_summary]:text-subtle [&>nav>button]:font-mono [&>nav>button]:text-xs [&_small]:font-mono" inert={running || (writing && !autosaveDraft)}><nav aria-label="Node inspector">{['Node', 'Details', 'Evidence'].map(item => <button key={item} className={inspectorTab === item ? 'is-active' : ''} aria-pressed={inspectorTab === item} onClick={() => setInspectorTab(item)}>{item}</button>)}</nav>{selected ? <div className="inspector-content pt-6 [&>h3]:mt-6 [&>h3]:mb-3 [&_h3]:text-sm [&_h3]:font-medium [&>.delete-node]:w-full [&>.delete-node]:border-t [&>.delete-node]:border-line [&>.delete-node]:pt-4"><div className="inspector-node-heading mb-5 flex items-center gap-3 [&_.app-mark]:size-10 [&_.app-mark]:rounded-control [&_h3]:m-0 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_p]:m-0 [&_p]:text-sm [&_p]:text-muted [&>button]:ml-auto [&>button]:grid [&>button]:size-8 [&>button]:place-items-center [&>button]:rounded-control [&>button]:text-muted [&>button]:hover:bg-sunken [&>button]:hover:text-ink [&_small]:font-mono [&_p]:font-mono [&_p]:text-xs">{selected.kind === 'Browser action' || selected.app ? <AppMark app={selected.kind === 'Browser action' ? 'Chrome' : selected.app!} /> : <span className="node-custom-icon grid size-7 shrink-0 place-items-center rounded-control border border-line bg-lilac text-lilac-ink [.data-processing-node_&]:bg-action-soft [.data-processing-node_&]:text-action"><Code2 size={24} /></span>}<div><h3>{selected.title}</h3><p>{selected.kind}</p></div><button aria-label="Node options" onClick={() => setDialog('Node options')}><MoreHorizontal size={19} /></button></div>
      {inspectorTab === 'Node' && <><textarea className="node-description-editor min-h-24 w-full min-w-0 resize-y rounded-control border border-line bg-canvas px-3 py-2.5 font-mono text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action" aria-label="Node description" value={selected.description} onChange={event => updateNode({ description: event.target.value })} />{selected.kind === 'Browser action' && <label className="editor-field font-mono my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted">Step name<input className="w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-mono text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50" aria-label="Browser step name" value={selected.title} onChange={event => updateNode({ title: event.target.value })} /></label>}{selected.kind === 'Browser action' && <label className="editor-field font-mono my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted">Starting dashboard / page URL<input className="w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-mono text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50" type="url" aria-label="Starting dashboard URL" placeholder="https://your-company.example/dashboard" value={selected.startUrl ?? ''} onChange={event => updateNode({ startUrl: event.target.value.trim() || null })} /><small>Record the entire browser process in this node, including navigation to other pages.</small></label>}{selected.kind === 'Browser action' && <details><summary>Structured outputs after replay (optional)</summary>{(['textSelector', 'tableSelector', 'jsonSelector'] as const).map(key => <label className="editor-field font-mono my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted" key={key}>{key === 'textSelector' ? 'Text element selector' : key === 'tableSelector' ? 'Table selector' : 'JSON element selector'}<input className="w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-mono text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50" value={selected.outputCapture?.[key] ?? ''} onChange={event => updateNode({ outputCapture: { ...selected.outputCapture, [key]: event.target.value || undefined } })} /></label>)}<small>Downloaded files are captured automatically. These selectors extract additional page data only after a successful replay.</small></details>}<label className="editor-field font-mono my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted">Status<select className={`w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-mono text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50 [&.is-ready]:bg-mint [&.is-ready]:text-success [&.needs-attention]:bg-peach [&.needs-attention]:text-warning ${['Ready', 'Learned'].includes(selected.status) ? 'is-ready bg-mint text-success' : 'needs-attention bg-peach text-warning'}`} value={selected.status} onChange={event => updateNode({ status: event.target.value as NodeStatus })}><option className="bg-panel text-ink">Needs teaching</option><option className="bg-panel text-ink">Needs configuration</option><option className="bg-panel text-ink">Ready</option><option className="bg-panel text-ink" disabled>Recorded</option><option className="bg-panel text-ink" disabled>Learned</option></select></label><div className="instruction-heading font-mono mb-2.5 text-sm font-medium text-subtle">Instructions</div><ol className="node-instructions m-0 grid list-none gap-2 p-0 [&>li]:flex [&>li]:min-h-11 [&>li]:items-center [&>li]:gap-2.5 [&>li]:rounded-control [&>li]:border [&>li]:border-line [&>li]:bg-panel [&>li]:px-2 [&>li]:py-1.5 [&>li>span]:grid [&>li>span]:size-6 [&>li>span]:shrink-0 [&>li>span]:place-items-center [&>li>span]:rounded-md [&>li>span]:bg-sunken [&>li>span]:text-xs [&>li>span]:text-muted [&>li>span]:tabular-nums [&_input]:min-w-0 [&_input]:w-full [&_input]:rounded [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-1 [&_input]:font-mono [&_input]:text-sm [&_input]:leading-6 [&_input]:text-ink [&_input]:focus-visible:outline-2 [&_input]:focus-visible:outline-action">{selected.instructions.map((instruction, index) => <li key={index}><span>{index + 1}</span><input aria-label={`Instruction ${index + 1}`} value={instruction} onChange={event => updateNode({ instructions: selected.instructions.map((value, i) => i === index ? event.target.value : value) })} /></li>)}</ol>{selected.kind === 'Browser action' && <><button className="dash-button recording-button mt-4 w-full min-h-11 text-sm" disabled={saving} onClick={() => { if (backendWorkflow) void saveBoard(); else if (id) { editorSnapshots.set(id, { nodes, title, connections }); setNotice('Node changes saved in this local preview.'); } }}>{saving ? 'Saving…' : 'Save Changes'}</button><small>Changes are also saved before opening the browser. To replace recorded actions, use Record again.</small><button className="dash-button dash-button--primary recording-button mt-4 w-full min-h-11 text-sm" disabled={saving} onClick={() => void teachNode(selected.id)}><CircleDot size={16} />{saving ? 'Saving…' : selected.status === 'Learned' ? 'View learned recording' : selected.status === 'Recorded' ? 'View saved recording' : 'Start recording'}</button>{['Learned', 'Recorded'].includes(selected.status) && <button className="dash-button recording-button mt-4 w-full min-h-11 text-sm" disabled={saving} onClick={() => void teachNode(selected.id, true)}><Plus size={16} />Record again</button>}</>}{(selected.contract || selected.kind === 'AI logic' || selected.kind === 'Human review') && <NodeDataContract contract={selected.contract} nodes={nodes} kind={selected.kind} />}<h3>Applications</h3><div className="inspector-app flex items-center gap-2.5 text-sm text-ink [&_.app-mark]:size-7">{selected.kind === 'Browser action' || selected.app ? <><AppMark app={selected.kind === 'Browser action' ? 'Chrome' : selected.app!} />{selected.app ?? 'Browser'}</> : <><Code2 size={20} />{selected.kind}</>}</div><div className="evidence-heading mt-6 flex items-center justify-between gap-3 [&>h3]:m-0"><h3>Evidence ({selectedEvidence.length})</h3><button className="text-button" onClick={() => setInspectorTab('Evidence')}>View all <ArrowRight size={14} /></button></div><p className="evidence-empty mt-3 mb-5 rounded-control border border-line bg-canvas p-4 text-sm leading-6 text-muted">{selectedEvidence.length ? `${selectedEvidence.length} Screenpipe source references · ${selectedSource?.basis === 'inferred' ? 'includes inferred steps' : 'observed activity'}` : 'No recorded evidence attached yet.'}</p><button className="delete-node flex items-center gap-2.5 text-sm text-danger" onClick={() => setDialog('Delete node')}><Trash2 size={18} />Delete node</button></>}
      {inspectorTab === 'Details' && <><label className="editor-field font-mono my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted">Step name<input className="w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-mono text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50" value={selected.title} onChange={event => updateNode({ title: event.target.value })} /></label><label className="editor-field font-mono my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted">Step type<select className="w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-mono text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50" value={selected.kind} onChange={event => updateNode({ kind: event.target.value, ...(event.target.value === 'Data Processing' ? { processing: defaultProcessing(), status: 'Needs configuration', app: undefined, contract: undefined } : {}) })}><option className="bg-panel text-ink">{selected.kind}</option>{['Browser action', 'Integration action', 'Data Processing', 'Application action', 'Transform', 'Output'].filter(kind => kind !== selected.kind).map(kind => <option className="bg-panel text-ink" key={kind}>{kind}</option>)}</select></label><label className="editor-field font-mono my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted">Application<select className="w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-mono text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50" value={selected.app ?? ''} onChange={event => updateNode({ app: (event.target.value || undefined) as AppName | undefined })}><option className="bg-panel text-ink" value="">None</option>{['Slack', 'Chrome', 'Excel', 'Gmail', 'Notion', 'Drive', 'Screenpipe'].map(app => <option className="bg-panel text-ink" key={app}>{app}</option>)}</select></label><button className="dash-button" onClick={() => updateNode({ instructions: [...selected.instructions, 'New instruction'] })}><Plus size={14} />Add instruction</button></>}
      {inspectorTab === 'Evidence' && <WorkflowEvidence agent={selectedSource?.source === 'screenpipe_pipe'} inferred={selectedSource?.basis === 'inferred'} references={(Array.isArray(selectedSource?.sourceReferences) ? selectedSource.sourceReferences : []).filter((v): v is string => typeof v === 'string')} evidence={selectedEvidence} missing={selectedMissing} />}
      </div> : <div className="inspector-empty px-5 py-8 text-center text-sm leading-7 text-muted [&>svg]:text-muted"><MousePointer2 size={25} /><p>Select a node to inspect its instructions and details.</p></div>}</div> : dialog === 'Delete node' ? <><p className="modal-copy">Delete “{selected?.title}” and its connected edges from this workflow?</p><button className="dash-button modal-action delete-node flex items-center gap-2.5 text-sm text-danger" onClick={() => { setNodes(current => current.filter(node => node.id !== selectedId)); setSelectedId(''); setSaved(false); setDialog(null) }}><Trash2 size={16} />Delete node</button></> : dialog === 'Share workflow' || dialog === 'Workflow options' ? <><p className="modal-copy">Export the current workflow and its edited instructions as a JSON file to keep or share.</p><button className="dash-button dash-button--primary modal-action" onClick={download}><Download size={16} />Export workflow</button></> : dialog === 'Run workflow' || dialog === 'Run options' || dialog === 'Teach this step' || dialog === 'Record' ? <>{nodes.some(n => n.kind === 'Data Processing') && <><p className="modal-copy">Run local processing using the latest successful browser downloads. Test browser recordings first to download fresh files.</p><button className="dash-button dash-button--primary" disabled={saving} onClick={() => void runProcessing()}>Run processing chain</button></>}<p className="modal-copy">{dialog === 'Teach this step' || dialog === 'Record' ? 'Screen recording is not connected in this preview. You can edit instructions directly in the node popup.' : nodes.some(n => n.kind === 'Data Processing') ? 'Processing runs locally and passes verified results to connected processing nodes.' : 'Live execution is not connected in this preview. Test run checks each step’s current readiness without opening apps or executing actions.'}</p><button className="dash-button dash-button--primary modal-action" onClick={() => { setDialog(null); testRun() }}><Play size={15} />Validate steps locally</button></> : dialog === 'Add node' ? <><p className="modal-copy">Add an action and configure its application, description, and instructions in the popup.</p><button className="dash-button dash-button--primary modal-action" onClick={() => addNode()}><Plus size={15} />Browser node</button><button className="dash-button modal-action" onClick={() => addNode('Integration action')}>Integration node</button><button className="dash-button modal-action" onClick={() => addNode('Data Processing')}>Data Processing node</button></> : dialog === 'Add connection' ? <WorkflowConnectionForm nodes={nodes} connections={activeEdges} selectedId={selectedId} onCancel={() => setDialog(null)} onAdd={(source, target) => { setConnections(current => [...current, [source, target]]); setSaved(false); setDialog(null); setNotice('Connection added.'); }} /> : dialog === 'Node options' ? <><button className="dash-button modal-action" onClick={() => { setInspectorTab('Details'); setDialog('Node details') }}><Pencil size={15} />Edit node details</button><button className="dash-button modal-action" onClick={() => setDialog('Delete node')}><Trash2 size={15} />Delete node</button></> : dialog === 'Canvas controls' ? <p className="modal-copy">Click a node to select it. Double-click or press Enter on a node to open its settings. Drag nodes to arrange them, or drag the background to pan. Use Ctrl/⌘ + scroll or + and − to zoom. Fit canvas brings every node into view.</p> : <p className="modal-copy">This workspace uses local sample data. Live integrations and recording are not connected yet. Return to the dashboard to explore the library and workspace settings.</p>}
    </DashboardDialog>}
  </div>
}
