import { evidenceSchema } from '../../../shared/screenpipeDiscovery'
import { browserInstructions } from '../../../shared/browserInstructions'
import { Database } from 'lucide-react'
import { DataProcessingInspector } from '../components/DataProcessingInspector'
import { defaultProcessing, operations, validateProcessing, type DataGraph, type ProcessingConfig, type ProcessingEvent, type DataFile } from '../../../shared/dataProcessing'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, CircleDot, Clock3, Code2, Copy, Download, Expand, FileText, Hand, LayoutGrid, Link, Map, Minus, MoreHorizontal, MousePointer2, Pencil, Play, Plus, Search, Share, Trash2, Workflow as WorkflowIcon } from '../components/ImageIcon'
import { savedEditorNodes } from '../data/savedEditorNodes'
import { NodeDataContract } from '../components/NodeDataContract'
import { GhostLogo } from '../components/GhostLogo'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { AppMark } from '../components/AppMark'
import { DashboardDialog } from '../components/DashboardDialog'
import { type AppName } from '../data/workflows'
import { makeNodes, edges, editorSnapshots, type EditorNode, type NodeStatus } from '../data/editorState'
import { useWorkflows } from '../data/workflowStore'
import '../styles/dashboard.css'
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
  const [processingStatus, setProcessingStatus] = useState<Record<string, ProcessingEvent>>({})
  useEffect(() => window.ghost?.processing.onStatus(event => { if (event.workflowId === id) setProcessingStatus(current => ({ ...current, [event.nodeId]: event })) }), [id])
  const [saved, setSaved] = useState(false)
  const [defining, setDefining] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBoard, setSavedBoard] = useState('')
  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; x: number; y: number; nx: number; ny: number } | null>(null)
  const didDrag = useRef(false)
  const teachingClick = useRef(false)
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const view = useRef({ zoom, offset })
  view.current = { zoom, offset }
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const selected = nodes.find(node => node.id === selectedId)
  const selectedSource = backendWorkflow?.nodes.find(node => node.id === selectedId)?.config
  const selectedEvidence = (Array.isArray(selectedSource?.evidence) ? selectedSource.evidence : []).flatMap(value => { const parsed = evidenceSchema.safeParse(value); return parsed.success ? [parsed.data] : [] })
  const selectedMissing = (Array.isArray(selectedSource?.missingInformation) ? selectedSource.missingInformation : []).filter((value): value is string => typeof value === 'string')
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
  useEffect(() => { if (backendWorkflow) setSavedBoard(boardSignature) }, [backendWorkflow])
  async function saveBoard(items = nodes) {
    if (!backendWorkflow || !window.ghost || saving) return false
    setSaving(true)
    const signature = JSON.stringify({ title, nodes: items, connections })
    try {
      const result = await window.ghost.updateWorkflow(backendWorkflow.id, {
        name: title,
        nodes: items.map((node, index) => {
          const original = backendWorkflow.nodes.find(item => item.id === node.id)
          return { id: node.id, label: node.title, type: node.kind === 'Data Processing' ? (node.processing?.operation === 'generate_report' ? 'OUTPUT' : 'TRANSFORM') : node.kind === 'AI logic' ? 'TRANSFORM' : node.kind === 'Human review' ? 'CONDITION' : original?.type ?? 'ACTION', positionX: node.x, positionY: node.y,
            config: { ...original?.config, outputCapture: node.outputCapture ?? {}, contract: node.kind === 'Data Processing' ? null : node.contract ?? null, ...(node.kind === 'Data Processing' ? { dataProcessing: node.processing ?? defaultProcessing(), executor: 'local' } : {}), stepType: node.kind === 'Data Processing' ? 'data_processing' : node.kind === 'Integration action' ? 'integration' : node.kind === 'AI logic' ? 'logic' : node.kind === 'Human review' ? 'review' : node.kind === 'Browser action' ? 'browser' : node.kind === 'Application action' ? 'application' : original?.config.stepType, order: index, description: node.description, startUrl: node.startUrl ?? null, instructions: node.instructions, application: node.app ?? null, status: node.status === 'Learned' ? 'learned' : node.status === 'Recorded' ? 'recorded' : node.status === 'Ready' ? 'ready' : node.status === 'Needs teaching' ? 'needs_recording' : 'needs_configuration' },
          }
        }),
        edges: activeEdges.map(([sourceNodeId, targetNodeId]) => ({ id: backendWorkflow.edges.find(e => e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId)?.id ?? crypto.randomUUID(), sourceNodeId, targetNodeId })),
      })
      if (result.ok) { setSavedBoard(signature); setNotice('Workflow saved to the backend.'); return true }
      else setNotice(result.error)
    } catch { setNotice('Unable to save workflow. Your edits are still on this board.') }
    finally { setSaving(false) }
    return false
  }
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
    const url = URL.createObjectURL(new Blob([JSON.stringify({ name: title, description: workflow?.description, steps: nodes.filter(node => node.id !== 'trigger').map(node => node.description), nodes }, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`; anchor.click(); URL.revokeObjectURL(url); setSaved(true); setNotice('Workflow exported as JSON.')
  }
  function testRun() { setLogOpen(true); setLogs(nodes.map(node => ({ action: node.title, detail: ['Ready', 'Learned'].includes(node.status) ? 'Step validated for preview' : node.status, app: node.app, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }))); setLogTab('Test results'); setNotice('Preview validation complete. No apps were opened or actions executed.') }
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
    setSaving(true); setLogOpen(true); setDialog(null); setNotice('Running local processing from saved browser downloads…')
    try {
      const results = await window.ghost.processing.run({ workflowId: id, graph: processingGraph() })
      setLogs(results.map(r => ({ action: nodes.find(n => n.id === r.nodeId)?.title ?? r.nodeId, status: r.status, files: Object.values(r.outputs).flatMap(value => value.type === 'files' ? value.value : []), detail: r.error ?? `${r.status} · ${Object.entries(r.outputs).map(([key, value]) => `${key}: ${Array.isArray(value.value) ? value.value.length : value.value}`).join(', ')}`, time: new Date().toLocaleTimeString() })))
      setNotice(results.some(r => r.status !== 'VERIFIED') ? 'Processing stopped with errors. See the run log.' : 'Local processing verified. Generated reports are available in the run log.')
    } catch (e) { setNotice(String(e)) } finally { setSaving(false) }
  }

  if (!workflow) return <div className="editor-not-found"><GhostLogo /><h1>Workflow not found.</h1><button className="dash-button" onClick={() => navigate('/dashboard')}>Back to dashboard</button></div>
  return <div className="editor-shell" data-page="workflow-editor" inert={defining} aria-busy={defining}>
    <WorkflowSidebar />

    <main className="editor-main">
      <header className="editor-header"><div className="editor-breadcrumb"><button onClick={() => navigate('/workflows')}><ArrowLeft size={14} />Workflows</button><ChevronRight size={13} /><span>{title}</span></div><div className="editor-actions">{backendWorkflow && <button className="dash-button" disabled={defining || saving || nodes.some(n => n.kind === 'Data Processing')} title={nodes.some(n => n.kind === 'Data Processing') ? 'Data Processing operations define their own typed contracts.' : undefined} onClick={() => void defineContracts()}>{defining ? 'Defining inputs…' : 'Define inputs & outputs'}</button>}{backendWorkflow && <button className="dash-button" disabled={saving || savedBoard === boardSignature} onClick={() => void saveBoard()}>{saving ? 'Saving…' : 'Save changes'}</button>}<button className="dash-button" onClick={() => setDialog('Share workflow')}><Share size={15} />Share</button><button className="dash-button" onClick={testRun}><Play size={15} />Test run</button><div className="run-button-group"><button className="dash-button dash-button--primary" onClick={() => setDialog('Run workflow')}><Play size={15} fill="currentColor" />Run</button><button className="dash-button dash-button--primary" aria-label="Run options" onClick={() => setDialog('Run options')}><ChevronDown size={15} /></button></div><button className="dash-button more-editor" aria-label="Workflow options" onClick={() => setDialog('Workflow options')}><MoreHorizontal size={18} /></button></div>
      <div className="editor-title-row">{editingTitle ? <input className="editor-title-input" aria-label="Workflow name" value={title} onChange={event => { setTitle(event.target.value); setSaved(false) }} onBlur={() => { setTitle(title.trim() || workflow.name); setEditingTitle(false) }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} autoFocus /> : <h1>{title}<button aria-label="Rename workflow" onClick={() => setEditingTitle(true)}><Pencil size={15} /></button></h1>}<button onClick={() => { const node = nodes.find(item => item.status === 'Needs teaching'); if (node) teachNode(node.id) }} className={`node-status ${needsAttention ? 'needs-attention' : 'is-ready'}`}><CircleDot size={12} />{needsAttention ? nodes.some(node => node.status === 'Needs teaching') ? 'Needs teaching' : nodes.some(node => node.status === 'Recorded') ? 'Needs testing' : 'Needs configuration' : nodes.some(node => node.status === 'Learned') ? 'Learned' : 'Ready'}</button><span className="editor-save-state">{backendWorkflow ? savedBoard === boardSignature ? 'Saved to backend' : 'Unsaved changes' : saved ? 'Exported' : 'Local preview · unsaved'}</span></div><p className="editor-description">{workflow.id === 'orders' ? 'Collect daily orders from Slack, check the dashboard, and generate an Excel report.' : workflow.description}</p>
      <nav className="editor-tabs" aria-label="Workflow views">{['Canvas', 'Steps', 'Runs', 'Activity', 'Settings'].map(item => <button key={item} className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav></header>
      <div className="editor-workspace"><div className="editor-center">
        {tab === 'Canvas' ? <div className={`workflow-canvas ${panMode ? 'is-pan-mode' : ''} ${panning ? 'is-panning' : ''}`} ref={canvasRef} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={() => { pan.current = null; setPanning(false) }} onPointerCancel={() => { pan.current = null; setPanning(false) }}>
          <div className="canvas-toolbar" aria-label="Canvas tools"><button className={!panMode ? 'is-active' : ''} aria-label="Select and move nodes" aria-pressed={!panMode} onClick={() => setPanMode(false)}><MousePointer2 size={19} fill="currentColor" /></button><button className={panMode ? 'is-active' : ''} aria-label="Pan canvas" aria-pressed={panMode} onClick={() => setPanMode(true)}><Hand size={19} /></button><button aria-label="Add node" onClick={() => setDialog('Add node')}><LayoutGrid size={18} /></button><button aria-label="View connections" onClick={() => setDialog('Connections')}><Link size={18} /></button><button aria-label="Duplicate selected node" disabled={!selected} onClick={() => { if (!selected) return; const nodeId = crypto.randomUUID(); setNodes(current => [...current, { ...selected, id: nodeId, title: `${selected.title} copy`, x: selected.x + 40, y: selected.y + 150 }]); setSelectedId(nodeId); setSaved(false) }}><Copy size={18} /></button><button aria-label="Delete selected node" disabled={!selected} onClick={() => setDialog('Delete node')}><Trash2 size={18} /></button><button aria-label="Search steps" onClick={() => setTab('Steps')}><Search size={18} /></button><button aria-label="Canvas options" onClick={() => setDialog('Canvas controls')}><MoreHorizontal size={18} /></button></div>
          <div className="canvas-view-controls"><div><button aria-label="Zoom out" onClick={() => zoomAt(zoom / 1.15)}><Minus size={15} /></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => zoomAt(zoom * 1.15)}><Plus size={15} /></button></div><button aria-label="Fit canvas" onClick={fitCanvas}><Expand size={17} /></button><button aria-label="Toggle minimap" aria-pressed={minimap} onClick={() => setMinimap(value => !value)}><Map size={17} /></button></div>
          <div className="canvas-world-wrap"><div className="canvas-world" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}><svg className="canvas-edges" viewBox="0 0 1000 590" aria-hidden="true">{activeEdges.map(([from, to]) => { const a = nodes.find(node => node.id === from)!; const b = nodes.find(node => node.id === to)!; let x1 = a.x + (a.id === 'trigger' ? 180 : 210); let y1 = a.y + (a.id === 'trigger' ? 29 : 58); let x2 = b.x; let y2 = b.y + 48; let path: string
            if (from === 'dashboard' && to === 'process') { x2 = b.x + 150; y2 = b.y; const corner = Math.min(20, Math.abs(x2 - x1) / 2); path = `M ${x1} ${y1} H ${x2 - corner} Q ${x2} ${y1} ${x2} ${y1 + corner} V ${y2}` }
            else if (from === 'process' && to === 'excel') { x1 = a.x; y1 = a.y + 48; x2 = b.x + 195; y2 = b.y; path = `M ${x1} ${y1} H ${x2 + 20} Q ${x2} ${y1} ${x2} ${y1 + 20} V ${y2}` }
            else { const bend = Math.min(65, Math.abs(x2 - x1) / 2); path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}` }
            return <path key={`${from}-${to}`} d={path} /> })}</svg>
          {nodes.map(node => <button key={node.id} className={`canvas-node ${node.kind === 'Data Processing' ? 'data-processing-node' : ''} ${node.id === selectedId ? 'is-selected' : ''} ${node.id === 'trigger' ? 'trigger-node' : ''} node-${node.id}`} style={{ left: node.x, top: node.y }} onClick={event => { if (!panMode && (!didDrag.current || event.detail === 0)) { if ((teachingClick.current || (event.target as HTMLElement).closest('.needs-attention')) && node.status === 'Needs teaching') teachNode(node.id); else openNode(node.id) } didDrag.current = false; teachingClick.current = false }} onPointerDown={event => { if (event.button !== 0 || panMode) return; event.stopPropagation(); didDrag.current = false; teachingClick.current = !!(event.target as HTMLElement).closest('.needs-attention'); setSelectedId(node.id); drag.current = { id: node.id, x: event.clientX, y: event.clientY, nx: node.x, ny: node.y }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={moveNode} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}><span className="node-port node-port-in" /><span className="node-heading">{node.kind === 'Browser action' || (node.app && node.kind !== 'Data Processing') ? <AppMark app={node.kind === 'Browser action' ? 'Chrome' : node.app!} /> : <span className={`node-custom-icon ${node.id === 'trigger' ? 'trigger-icon' : ''}`}>{node.id === 'trigger' ? <Clock3 size={22} /> : node.kind === 'Data Processing' ? <Database size={23} /> : <Code2 size={23} />}</span>}<span><strong>{node.title}</strong><small>{node.kind === 'Data Processing' ? operations[node.processing?.operation ?? 'read_files'].label : node.kind}</small></span><MoreHorizontal size={16} /></span>{node.id !== 'trigger' && <><span className="node-description">{node.description}</span>{node.kind === 'Data Processing' && <span className="node-data-types"><span>Input: {operations[node.processing?.operation ?? 'read_files'].inputs.map(p => p.type).join(', ')}</span><span>Output: {operations[node.processing?.operation ?? 'read_files'].outputs.map(p => p.type).join(', ')}</span></span>}<span className={`node-status ${['Ready', 'Learned'].includes(node.status) ? 'is-ready' : 'needs-attention'}`}><CircleDot size={11} />{node.status}</span>{processingStatus[node.id] && <span className="node-run-status" role="status">{processingStatus[node.id].status}</span>}</>}<span className="node-port node-port-out" /></button>)}
          </div></div>
          {minimap && <button className="canvas-minimap" aria-label="Reset canvas view" onClick={fitCanvas}><svg viewBox="0 0 1000 590" aria-hidden="true">{nodes.map(node => <rect key={node.id} x={node.x} y={node.y} width={node.id === 'trigger' ? 180 : 210} height={node.id === 'trigger' ? 58 : 130} className={node.id === selectedId ? 'selected' : ''} />)}<rect className="minimap-viewport" x="55" y="55" width="910" height="500" /></svg><span>{nodes.length} nodes&nbsp; {activeEdges.length} edges <Expand size={13} /></span></button>}
          <div className="canvas-hint">Drag to pan <span>·</span> Ctrl / ⌘ + scroll to zoom <span>·</span> Click a node to edit</div>
        </div> : <section className="editor-tab-content"><h2>{tab}</h2>{tab === 'Steps' && <><p>Select a step to edit its instructions in the popup.</p>{nodes.map((node, index) => <button className={`editor-step-row ${node.id === selectedId ? 'is-selected' : ''}`} key={node.id} onClick={() => openNode(node.id)}><span>{index + 1}</span><strong>{node.title}</strong><span className={`node-status ${['Ready', 'Learned'].includes(node.status) ? 'is-ready' : 'needs-attention'}`}>{node.status}</span><ChevronRight size={15} /></button>)}<button className="dash-button" onClick={() => addNode()}><Plus size={15} />Add step</button></>}{(tab === 'Runs' || tab === 'Activity') && <><p>{logs.length ? logs.some(log => log.status) ? 'Latest local processing results.' : 'Latest local preview validation. No external actions were executed.' : 'No runs yet. Use Test run to validate the current steps locally.'}</p>{logs.map((log, index) => <div className="editor-history-row" key={index}><Clock3 size={16} /><time>{log.time}</time><strong>{log.action}</strong><span>{log.detail}</span></div>)}</>}{tab === 'Settings' && <><p>{backendWorkflow ? 'Use Save changes to persist edits to the backend.' : 'Workflow changes stay in this page until you export them.'}</p><label className="editor-field">Workflow name<input value={title} onChange={event => { setTitle(event.target.value); setSaved(false) }} /></label><button className="dash-button dash-button--primary" onClick={download}><Download size={15} />Export workflow</button></>}</section>}
        <section className={`editor-log ${logOpen ? 'is-expanded' : 'is-collapsed'}`}><header><button className="log-toggle" aria-label={logOpen ? 'Collapse run log' : 'Expand run log'} aria-expanded={logOpen} onClick={() => setLogOpen(value => !value)}><ChevronDown size={16} /></button><div>{['Run log', 'Test results'].map(item => <button key={item} className={logTab === item ? 'is-active' : ''} onClick={() => { setLogTab(item); setLogOpen(true) }}>{item}</button>)}</div><span className="log-preview-dot" /> <span>{logs.some(log => log.status) ? 'Local processing' : 'Local preview'}</span><button className="dash-button" onClick={() => setLogs([])}><Trash2 size={13} />Clear</button></header>{logOpen && (logs.length ? <div className="log-rows">{logs.map((log, index) => <div className="log-row" key={index}><time>{log.time}</time>{log.app ? <AppMark app={log.app} /> : <Clock3 size={14} />}<strong>{log.action}</strong><span>{log.detail}{log.files?.map(file => <button className="text-button" key={file.id} onClick={() => void window.ghost?.processing.reveal(id!, file.id).catch(error => setNotice(String(error)))}>{file.name}</button>)}</span><span className={(log.status === 'VERIFIED' || log.detail.startsWith('Step')) ? 'log-success' : 'log-warning'}><CircleDot size={11} />{log.status ?? (log.detail.startsWith('Step') ? 'Validated' : 'Needs review')}</span></div>)}</div> : <div className="log-empty"><WorkflowIcon size={21} /><p>{logTab === 'Run log' ? 'Your workflow’s run history will appear here.' : 'Test your workflow to check its steps.'}<span>Run a local preview to validate the steps without executing actions.</span></p><button className="text-button" onClick={testRun}>Test run <ArrowRight size={14} /></button></div>)}</section>
      </div>
      </div>
    </main>
    {notice && <div className="dashboard-toast" role="status"><Check size={16} />{notice}</div>}
    {dialog && <DashboardDialog title={dialog === 'Node details' ? (selected?.title ?? 'Node details') : dialog} className={dialog === 'Node details' ? 'node-details-dialog' : undefined} onClose={() => setDialog(null)}>
      {dialog === 'Node details' && selected?.kind === 'Data Processing' ? <DataProcessingInspector key={selected.id} node={selected} nodes={nodes} graph={processingGraph()} workflowId={id!} onChange={updateNode} onSave={saveProcessing} /> : dialog === 'Node details' ?       <div className="node-popup" inert={saving}><nav aria-label="Node inspector">{['Node', 'Details', 'Evidence'].map(item => <button key={item} className={inspectorTab === item ? 'is-active' : ''} onClick={() => setInspectorTab(item)}>{item}</button>)}</nav>{selected ? <div className="inspector-content"><div className="inspector-node-heading">{selected.kind === 'Browser action' || selected.app ? <AppMark app={selected.kind === 'Browser action' ? 'Chrome' : selected.app!} /> : <span className="node-custom-icon"><Code2 size={24} /></span>}<div><h3>{selected.title}</h3><p>{selected.kind}</p></div><button aria-label="Node options" onClick={() => setDialog('Node options')}><MoreHorizontal size={19} /></button></div>
      {inspectorTab === 'Node' && <><textarea className="node-description-editor" aria-label="Node description" value={selected.description} onChange={event => updateNode({ description: event.target.value })} />{selected.kind === 'Browser action' && <label className="editor-field">Step name<input aria-label="Browser step name" value={selected.title} onChange={event => updateNode({ title: event.target.value })} /></label>}{selected.kind === 'Browser action' && <label className="editor-field">Starting dashboard / page URL<input type="url" aria-label="Starting dashboard URL" placeholder="https://your-company.example/dashboard" value={selected.startUrl ?? ''} onChange={event => updateNode({ startUrl: event.target.value.trim() || null })} /><small>Record the entire browser process in this node, including navigation to other pages.</small></label>}{selected.kind === 'Browser action' && <details><summary>Structured outputs after replay (optional)</summary>{(['textSelector', 'tableSelector', 'jsonSelector'] as const).map(key => <label className="editor-field" key={key}>{key === 'textSelector' ? 'Text element selector' : key === 'tableSelector' ? 'Table selector' : 'JSON element selector'}<input value={selected.outputCapture?.[key] ?? ''} onChange={event => updateNode({ outputCapture: { ...selected.outputCapture, [key]: event.target.value || undefined } })} /></label>)}<small>Downloaded files are captured automatically. These selectors extract additional page data only after a successful replay.</small></details>}<label className="editor-field">Status<select className={['Ready', 'Learned'].includes(selected.status) ? 'is-ready' : 'needs-attention'} value={selected.status} onChange={event => updateNode({ status: event.target.value as NodeStatus })}><option>Needs teaching</option><option>Needs configuration</option><option>Ready</option><option disabled>Recorded</option><option disabled>Learned</option></select></label><div className="instruction-heading">Instructions</div><ol className="node-instructions">{selected.instructions.map((instruction, index) => <li key={index}><span>{index + 1}</span><input aria-label={`Instruction ${index + 1}`} value={instruction} onChange={event => updateNode({ instructions: selected.instructions.map((value, i) => i === index ? event.target.value : value) })} /></li>)}</ol>{selected.kind === 'Browser action' && <><button className="dash-button recording-button" disabled={saving} onClick={() => { if (backendWorkflow) void saveBoard(); else if (id) { editorSnapshots.set(id, { nodes, title, connections }); setNotice('Node changes saved in this local preview.'); } }}>{saving ? 'Saving…' : 'Save Changes'}</button><small>Changes are also saved before opening the browser. To replace recorded actions, use Record again.</small><button className="dash-button dash-button--primary recording-button" disabled={saving} onClick={() => void teachNode(selected.id)}><CircleDot size={16} />{saving ? 'Saving…' : selected.status === 'Learned' ? 'View learned recording' : selected.status === 'Recorded' ? 'View saved recording' : 'Start recording'}</button>{['Learned', 'Recorded'].includes(selected.status) && <button className="dash-button recording-button" disabled={saving} onClick={() => void teachNode(selected.id, true)}><Plus size={16} />Record again</button>}</>}{(selected.contract || selected.kind === 'AI logic' || selected.kind === 'Human review') && <NodeDataContract contract={selected.contract} nodes={nodes} kind={selected.kind} />}<h3>Applications</h3><div className="inspector-app">{selected.kind === 'Browser action' || selected.app ? <><AppMark app={selected.kind === 'Browser action' ? 'Chrome' : selected.app!} />{selected.app ?? 'Browser'}</> : <><Code2 size={20} />{selected.kind}</>}</div><div className="evidence-heading"><h3>Evidence ({selectedEvidence.length})</h3><button className="text-button" onClick={() => setInspectorTab('Evidence')}>View all <ArrowRight size={14} /></button></div><p className="evidence-empty">{selectedEvidence.length ? `${selectedEvidence.length} Screenpipe source references · ${selectedSource?.basis === 'inferred' ? 'includes inferred steps' : 'observed activity'}` : 'No recorded evidence attached yet.'}</p><button className="delete-node" onClick={() => setDialog('Delete node')}><Trash2 size={18} />Delete node</button></>}
      {inspectorTab === 'Details' && <><label className="editor-field">Step name<input value={selected.title} onChange={event => updateNode({ title: event.target.value })} /></label><label className="editor-field">Step type<select value={selected.kind} onChange={event => updateNode({ kind: event.target.value, ...(event.target.value === 'Data Processing' ? { processing: defaultProcessing(), status: 'Needs configuration', app: undefined, contract: undefined } : {}) })}><option>{selected.kind}</option>{['Browser action', 'Integration action', 'Data Processing', 'Application action', 'Transform', 'Output'].filter(kind => kind !== selected.kind).map(kind => <option key={kind}>{kind}</option>)}</select></label><label className="editor-field">Application<select value={selected.app ?? ''} onChange={event => updateNode({ app: (event.target.value || undefined) as AppName | undefined })}><option value="">None</option>{['Slack', 'Chrome', 'Excel', 'Gmail', 'Notion', 'Drive', 'Screenpipe'].map(app => <option key={app}>{app}</option>)}</select></label><button className="dash-button" onClick={() => updateNode({ instructions: [...selected.instructions, 'New instruction'] })}><Plus size={14} />Add instruction</button></>}
      {inspectorTab === 'Evidence' && selectedSource?.source === 'screenpipe_pipe' && <section><h3>Screenpipe agent response</h3><p>References reported by Screenpipe; not independently verified by Ghost.</p><ul>{(Array.isArray(selectedSource.sourceReferences) ? selectedSource.sourceReferences : []).filter((v): v is string => typeof v === 'string').map((value, index) => <li key={index}>{value}</li>)}</ul><h3>Needs confirmation</h3><ul>{selectedMissing.map((value, index) => <li key={index}>{value}</li>)}</ul></section>}
      {inspectorTab === 'Evidence' && selectedSource?.source !== 'screenpipe_pipe' && (selectedEvidence.length ? <section><h3>Screenpipe evidence</h3><p>{selectedSource?.basis === 'inferred' ? 'This step includes an inference. Confirm the missing information before teaching.' : 'These source references support the discovered step. Review the description before teaching.'}</p><ul>{selectedEvidence.map(item => <li key={item.id}><strong>{item.application}</strong><p>{item.windowName}</p><time dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString()}</time><p><code>{item.id}</code></p>{item.url && <p>{item.url}</p>}</li>)}</ul>{selectedMissing.length > 0 && <><h3>Needs confirmation</h3><ul>{selectedMissing.map((item, index) => <li key={index}>{item}</li>)}</ul></>}</section> : <div className="inspector-empty"><FileText size={28} /><h3>No evidence yet</h3><p>This node has no Screenpipe source references attached.</p></div>)}
      </div> : <div className="inspector-empty"><MousePointer2 size={25} /><p>Select a node to inspect its instructions and details.</p></div>}</div> : dialog === 'Delete node' ? <><p className="modal-copy">Delete “{selected?.title}” and its connected edges from this workflow?</p><button className="dash-button modal-action delete-node" onClick={() => { setNodes(current => current.filter(node => node.id !== selectedId)); setSelectedId(''); setSaved(false); setDialog(null) }}><Trash2 size={16} />Delete node</button></> : dialog === 'Share workflow' || dialog === 'Workflow options' ? <><p className="modal-copy">Export the current workflow and its edited instructions as a JSON file to keep or share.</p><button className="dash-button dash-button--primary modal-action" onClick={download}><Download size={16} />Export workflow</button></> : dialog === 'Run workflow' || dialog === 'Run options' || dialog === 'Teach this step' || dialog === 'Record' ? <>{nodes.some(n => n.kind === 'Data Processing') && <><p className="modal-copy">Run local processing using the latest successful browser downloads. Test browser recordings first to download fresh files.</p><button className="dash-button dash-button--primary" disabled={saving} onClick={() => void runProcessing()}>Run processing chain</button></>}<p className="modal-copy">{dialog === 'Teach this step' || dialog === 'Record' ? 'Screen recording is not connected in this preview. You can edit instructions directly in the node popup.' : nodes.some(n => n.kind === 'Data Processing') ? 'Processing runs locally and passes verified results to connected processing nodes.' : 'Live execution is not connected in this preview. Test run checks each step’s current readiness without opening apps or executing actions.'}</p><button className="dash-button dash-button--primary modal-action" onClick={() => { setDialog(null); testRun() }}><Play size={15} />Validate steps locally</button></> : dialog === 'Add node' ? <><p className="modal-copy">Add an action and configure its application, description, and instructions in the popup.</p><button className="dash-button dash-button--primary modal-action" onClick={() => addNode()}><Plus size={15} />Browser node</button><button className="dash-button modal-action" onClick={() => addNode('Integration action')}>Integration node</button><button className="dash-button modal-action" onClick={() => addNode('Data Processing')}>Data Processing node</button></> : dialog === 'Connections' ? <><p className="modal-copy">Current workflow connections</p><ol className="review-steps">{activeEdges.map(([from, to]) => <li key={`${from}-${to}`}>{nodes.find(node => node.id === from)?.title}<ArrowRight size={14} />{nodes.find(node => node.id === to)?.title}</li>)}</ol></> : dialog === 'Node options' ? <><button className="dash-button modal-action" onClick={() => { setInspectorTab('Details'); setDialog('Node details') }}><Pencil size={15} />Edit node details</button><button className="dash-button modal-action" onClick={() => setDialog('Delete node')}><Trash2 size={15} />Delete node</button></> : dialog === 'Canvas controls' ? <p className="modal-copy">Click a node to open its details. Drag nodes to arrange them, or drag the background to pan. Use Ctrl/⌘ + scroll or + and − to zoom. Fit canvas brings every node into view.</p> : <p className="modal-copy">This workspace uses local sample data. Live integrations and recording are not connected yet. Return to the dashboard to explore the library and workspace settings.</p>}
    </DashboardDialog>}
  </div>
}
