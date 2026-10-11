import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, CircleDot, Clock3, Code2, Copy, Download, Expand, FileText, Hand, LayoutGrid, Link, Map, Minus, MoreHorizontal, MousePointer2, Pencil, Play, Plus, Search, Share, Trash2, Workflow as WorkflowIcon } from 'lucide-react'
import { GhostLogo } from '../components/GhostLogo'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { AppMark } from '../components/AppMark'
import { DashboardDialog } from '../components/DashboardDialog'
import { type AppName } from '../data/workflows'
import { makeNodes, edges, editorSnapshots, type EditorNode, type NodeStatus } from '../data/editorState'
import { useWorkflows } from '../data/workflowStore'
import '../styles/dashboard.css'
import '../styles/workflow-editor.css'

type Log = { action: string; detail: string; app?: AppName; time: string }
export function WorkflowEditor() {
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
  const [saved, setSaved] = useState(false)
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
  const scale = zoom
  const connections = workflow?.id === 'orders' ? edges : nodes.slice(1).map((node, index) => [nodes[index].id, node.id])
  const activeEdges = connections.filter(([from, to]) => nodes.some(node => node.id === from) && nodes.some(node => node.id === to))
  const needsAttention = nodes.some(node => node.status !== 'Ready')
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
  useEffect(() => { if (id && workflow) editorSnapshots.set(id, { nodes, title }) }, [id, workflow, nodes, title])
  function teachNode(nodeId: string) { navigate(`/workflows/${id}/record/${nodeId}`) }
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
  function updateNode(patch: Partial<EditorNode>) { setNodes(current => current.map(node => node.id === selectedId ? { ...node, ...patch } : node)); setSaved(false) }
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
  function testRun() { setLogOpen(true); setLogs(nodes.map(node => ({ action: node.title, detail: node.status === 'Ready' ? 'Step validated for preview' : node.status, app: node.app, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }))); setLogTab('Test results'); setNotice('Preview validation complete. No apps were opened or actions executed.') }
  function addNode() { const nodeId = crypto.randomUUID(); setNodes(current => [...current, { id: nodeId, title: 'New action', kind: 'Browser action', description: 'Describe what this step should do.', status: 'Needs teaching', instructions: ['Add an instruction'], x: 420, y: 240 }]); openNode(nodeId); setSaved(false) }
  if (!workflow) return <div className="editor-not-found"><GhostLogo /><h1>Workflow not found.</h1><button className="dash-button" onClick={() => navigate('/dashboard')}>Back to dashboard</button></div>
  return <div className="editor-shell" data-page="workflow-editor">
    <WorkflowSidebar />

    <main className="editor-main">
      <header className="editor-header"><div className="editor-breadcrumb"><button onClick={() => navigate('/workflows')}><ArrowLeft size={14} />Workflows</button><ChevronRight size={13} /><span>{title}</span></div><div className="editor-actions"><button className="dash-button" onClick={() => setDialog('Share workflow')}><Share size={15} />Share</button><button className="dash-button" onClick={testRun}><Play size={15} />Test run</button><div className="run-button-group"><button className="dash-button dash-button--primary" onClick={() => setDialog('Run workflow')}><Play size={15} fill="currentColor" />Run</button><button className="dash-button dash-button--primary" aria-label="Run options" onClick={() => setDialog('Run options')}><ChevronDown size={15} /></button></div><button className="dash-button more-editor" aria-label="Workflow options" onClick={() => setDialog('Workflow options')}><MoreHorizontal size={18} /></button></div>
      <div className="editor-title-row">{editingTitle ? <input className="editor-title-input" aria-label="Workflow name" value={title} onChange={event => { setTitle(event.target.value); setSaved(false) }} onBlur={() => { setTitle(title.trim() || workflow.name); setEditingTitle(false) }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} autoFocus /> : <h1>{title}<button aria-label="Rename workflow" onClick={() => setEditingTitle(true)}><Pencil size={15} /></button></h1>}<button onClick={() => { const node = nodes.find(item => item.status === 'Needs teaching'); if (node) teachNode(node.id) }} className={`node-status ${needsAttention ? 'needs-attention' : 'is-ready'}`}><CircleDot size={12} />{needsAttention ? 'Needs teaching' : 'Ready'}</button><span className="editor-save-state">{saved ? 'Exported' : 'Local preview · unsaved'}</span></div><p className="editor-description">{workflow.id === 'orders' ? 'Collect daily orders from Slack, check the dashboard, and generate an Excel report.' : workflow.description}</p>
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
          {nodes.map(node => <button key={node.id} className={`canvas-node ${node.id === selectedId ? 'is-selected' : ''} ${node.id === 'trigger' ? 'trigger-node' : ''} node-${node.id}`} style={{ left: node.x, top: node.y }} onClick={event => { if (!panMode && (!didDrag.current || event.detail === 0)) { if ((teachingClick.current || (event.target as HTMLElement).closest('.needs-attention')) && node.status === 'Needs teaching') teachNode(node.id); else openNode(node.id) } didDrag.current = false; teachingClick.current = false }} onPointerDown={event => { if (event.button !== 0 || panMode) return; event.stopPropagation(); didDrag.current = false; teachingClick.current = !!(event.target as HTMLElement).closest('.needs-attention'); setSelectedId(node.id); drag.current = { id: node.id, x: event.clientX, y: event.clientY, nx: node.x, ny: node.y }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={moveNode} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}><span className="node-port node-port-in" /><span className="node-heading">{node.app ? <AppMark app={node.app} /> : <span className={`node-custom-icon ${node.id === 'trigger' ? 'trigger-icon' : ''}`}>{node.id === 'trigger' ? <Clock3 size={22} /> : <Code2 size={23} />}</span>}<span><strong>{node.title}</strong><small>{node.kind}</small></span><MoreHorizontal size={16} /></span>{node.id !== 'trigger' && <><span className="node-description">{node.description}</span><span className={`node-status ${node.status === 'Ready' ? 'is-ready' : 'needs-attention'}`}><CircleDot size={11} />{node.status}</span></>}<span className="node-port node-port-out" /></button>)}
          </div></div>
          {minimap && <button className="canvas-minimap" aria-label="Reset canvas view" onClick={fitCanvas}><svg viewBox="0 0 1000 590" aria-hidden="true">{nodes.map(node => <rect key={node.id} x={node.x} y={node.y} width={node.id === 'trigger' ? 180 : 210} height={node.id === 'trigger' ? 58 : 130} className={node.id === selectedId ? 'selected' : ''} />)}<rect className="minimap-viewport" x="55" y="55" width="910" height="500" /></svg><span>{nodes.length} nodes&nbsp; {activeEdges.length} edges <Expand size={13} /></span></button>}
          <div className="canvas-hint">Drag to pan <span>·</span> Ctrl / ⌘ + scroll to zoom <span>·</span> Click a node to edit</div>
        </div> : <section className="editor-tab-content"><h2>{tab}</h2>{tab === 'Steps' && <><p>Select a step to edit its instructions in the popup.</p>{nodes.map((node, index) => <button className={`editor-step-row ${node.id === selectedId ? 'is-selected' : ''}`} key={node.id} onClick={() => openNode(node.id)}><span>{index + 1}</span><strong>{node.title}</strong><span className={`node-status ${node.status === 'Ready' ? 'is-ready' : 'needs-attention'}`}>{node.status}</span><ChevronRight size={15} /></button>)}<button className="dash-button" onClick={addNode}><Plus size={15} />Add step</button></>}{(tab === 'Runs' || tab === 'Activity') && <><p>{logs.length ? 'Latest local preview validation. No external actions were executed.' : 'No runs yet. Use Test run to validate the current steps locally.'}</p>{logs.map((log, index) => <div className="editor-history-row" key={index}><Clock3 size={16} /><time>{log.time}</time><strong>{log.action}</strong><span>{log.detail}</span></div>)}</>}{tab === 'Settings' && <><p>Workflow changes stay in this page until you export them.</p><label className="editor-field">Workflow name<input value={title} onChange={event => { setTitle(event.target.value); setSaved(false) }} /></label><button className="dash-button dash-button--primary" onClick={download}><Download size={15} />Export workflow</button></>}</section>}
        <section className={`editor-log ${logOpen ? 'is-expanded' : 'is-collapsed'}`}><header><button className="log-toggle" aria-label={logOpen ? 'Collapse run log' : 'Expand run log'} aria-expanded={logOpen} onClick={() => setLogOpen(value => !value)}><ChevronDown size={16} /></button><div>{['Run log', 'Test results'].map(item => <button key={item} className={logTab === item ? 'is-active' : ''} onClick={() => { setLogTab(item); setLogOpen(true) }}>{item}</button>)}</div><span className="log-preview-dot" /> <span>Local preview</span><button className="dash-button" onClick={() => setLogs([])}><Trash2 size={13} />Clear</button></header>{logOpen && (logs.length ? <div className="log-rows">{logs.map((log, index) => <div className="log-row" key={index}><time>{log.time}</time>{log.app ? <AppMark app={log.app} /> : <Clock3 size={14} />}<strong>{log.action}</strong><span>{log.detail}</span><span className={log.detail.startsWith('Step') ? 'log-success' : 'log-warning'}><CircleDot size={11} />{log.detail.startsWith('Step') ? 'Validated' : 'Needs review'}</span></div>)}</div> : <div className="log-empty"><WorkflowIcon size={21} /><p>{logTab === 'Run log' ? 'Your workflow’s run history will appear here.' : 'Test your workflow to check its steps.'}<span>Run a local preview to validate the steps without executing actions.</span></p><button className="text-button" onClick={testRun}>Test run <ArrowRight size={14} /></button></div>)}</section>
      </div>
      </div>
    </main>
    {notice && <div className="dashboard-toast" role="status"><Check size={16} />{notice}</div>}
    {dialog && <DashboardDialog title={dialog === 'Node details' ? (selected?.title ?? 'Node details') : dialog} className={dialog === 'Node details' ? 'node-details-dialog' : undefined} onClose={() => setDialog(null)}>
      {dialog === 'Node details' ?       <div className="node-popup"><nav aria-label="Node inspector">{['Node', 'Details', 'Evidence'].map(item => <button key={item} className={inspectorTab === item ? 'is-active' : ''} onClick={() => setInspectorTab(item)}>{item}</button>)}</nav>{selected ? <div className="inspector-content"><div className="inspector-node-heading">{selected.app ? <AppMark app={selected.app} /> : <span className="node-custom-icon"><Code2 size={24} /></span>}<div><h3>{selected.title}</h3><p>{selected.kind}</p></div><button aria-label="Node options" onClick={() => setDialog('Node options')}><MoreHorizontal size={19} /></button></div>
      {inspectorTab === 'Node' && <><textarea className="node-description-editor" aria-label="Node description" value={selected.description} onChange={event => updateNode({ description: event.target.value })} /><label className="editor-field">Status<select className={selected.status === 'Ready' ? 'is-ready' : 'needs-attention'} value={selected.status} onChange={event => updateNode({ status: event.target.value as NodeStatus })}><option>Needs teaching</option><option>Needs configuration</option><option>Ready</option></select></label><div className="instruction-heading">Instructions</div><ol className="node-instructions">{selected.instructions.map((instruction, index) => <li key={index}><span>{index + 1}</span><input aria-label={`Instruction ${index + 1}`} value={instruction} onChange={event => updateNode({ instructions: selected.instructions.map((value, i) => i === index ? event.target.value : value) })} /></li>)}</ol><button className="dash-button dash-button--primary recording-button" onClick={() => teachNode(selected.id)}><CircleDot size={16} />Start recording</button><h3>Applications</h3><div className="inspector-app">{selected.app ? <><AppMark app={selected.app} />{selected.app}</> : <><Code2 size={20} />{selected.kind}</>}</div><div className="evidence-heading"><h3>Evidence (0)</h3><button className="text-button" onClick={() => setInspectorTab('Evidence')}>View all <ArrowRight size={14} /></button></div><p className="evidence-empty">No recorded evidence attached yet.</p><button className="delete-node" onClick={() => setDialog('Delete node')}><Trash2 size={18} />Delete node</button></>}
      {inspectorTab === 'Details' && <><label className="editor-field">Step name<input value={selected.title} onChange={event => updateNode({ title: event.target.value })} /></label><label className="editor-field">Step type<select value={selected.kind} onChange={event => updateNode({ kind: event.target.value })}><option>{selected.kind}</option>{['Browser action', 'Transform', 'Output'].filter(kind => kind !== selected.kind).map(kind => <option key={kind}>{kind}</option>)}</select></label><label className="editor-field">Application<select value={selected.app ?? ''} onChange={event => updateNode({ app: (event.target.value || undefined) as AppName | undefined })}><option value="">None</option>{['Slack', 'Chrome', 'Excel', 'Gmail', 'Notion', 'Drive', 'Screenpipe'].map(app => <option key={app}>{app}</option>)}</select></label><button className="dash-button" onClick={() => updateNode({ instructions: [...selected.instructions, 'New instruction'] })}><Plus size={14} />Add instruction</button></>}
      {inspectorTab === 'Evidence' && <div className="inspector-empty"><FileText size={28} /><h3>No evidence yet</h3><p>Screenpipe recordings and captured actions will appear here when a live connection is available.</p></div>}
      </div> : <div className="inspector-empty"><MousePointer2 size={25} /><p>Select a node to inspect its instructions and details.</p></div>}</div> : dialog === 'Delete node' ? <><p className="modal-copy">Delete “{selected?.title}” and its connected edges from this workflow?</p><button className="dash-button modal-action delete-node" onClick={() => { setNodes(current => current.filter(node => node.id !== selectedId)); setSelectedId(''); setSaved(false); setDialog(null) }}><Trash2 size={16} />Delete node</button></> : dialog === 'Share workflow' || dialog === 'Workflow options' ? <><p className="modal-copy">Export the current workflow and its edited instructions as a JSON file to keep or share.</p><button className="dash-button dash-button--primary modal-action" onClick={download}><Download size={16} />Export workflow</button></> : dialog === 'Run workflow' || dialog === 'Run options' || dialog === 'Teach this step' || dialog === 'Record' ? <><p className="modal-copy">{dialog === 'Teach this step' || dialog === 'Record' ? 'Screen recording is not connected in this preview. You can edit instructions directly in the node popup.' : 'Live execution is not connected in this preview. Test run checks each step’s current readiness without opening apps or executing actions.'}</p><button className="dash-button dash-button--primary modal-action" onClick={() => { setDialog(null); testRun() }}><Play size={15} />Validate steps locally</button></> : dialog === 'Add node' ? <><p className="modal-copy">Add an action and configure its application, description, and instructions in the popup.</p><button className="dash-button dash-button--primary modal-action" onClick={addNode}><Plus size={15} />Add action</button></> : dialog === 'Connections' ? <><p className="modal-copy">Current workflow connections</p><ol className="review-steps">{activeEdges.map(([from, to]) => <li key={`${from}-${to}`}>{nodes.find(node => node.id === from)?.title}<ArrowRight size={14} />{nodes.find(node => node.id === to)?.title}</li>)}</ol></> : dialog === 'Node options' ? <><button className="dash-button modal-action" onClick={() => { setInspectorTab('Details'); setDialog('Node details') }}><Pencil size={15} />Edit node details</button><button className="dash-button modal-action" onClick={() => setDialog('Delete node')}><Trash2 size={15} />Delete node</button></> : dialog === 'Canvas controls' ? <p className="modal-copy">Click a node to open its details. Drag nodes to arrange them, or drag the background to pan. Use Ctrl/⌘ + scroll or + and − to zoom. Fit canvas brings every node into view.</p> : <p className="modal-copy">This workspace uses local sample data. Live integrations and recording are not connected yet. Return to the dashboard to explore the library and workspace settings.</p>}
    </DashboardDialog>}
  </div>
}
