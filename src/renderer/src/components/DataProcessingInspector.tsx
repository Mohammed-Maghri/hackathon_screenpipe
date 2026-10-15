import { RuntimeLogicInspector } from './RuntimeLogicInspector'
import { useEffect, useState } from 'react'
import { defaultProcessing, operations, outputPorts, isUpstream, validateProcessing, type DataGraph, type Operation, type OperationName, type ProcessingConfig, type ProcessingResult } from '../../../shared/dataProcessing'
import type { EditorNode } from '../data/editorState'

export function DataProcessingInspector({ node, graph, nodes, workflowId, onChange, onSave }: { node: EditorNode; graph: DataGraph; nodes: EditorNode[]; workflowId: string; onChange: (patch: Partial<EditorNode>) => void; onSave: (config: ProcessingConfig) => Promise<boolean> }) {
  const config = node.processing ?? defaultProcessing()
  const [rulesText, setRulesText] = useState(JSON.stringify(config.rules, null, 2))
  const [jsonError, setJsonError] = useState('')
  const [results, setResults] = useState<ProcessingResult[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => window.ghost?.processing.onStatus(event => { if (event.workflowId === workflowId && event.status === 'RUNNING') setMessage(`Running ${nodes.find(n => n.id === event.nodeId)?.title ?? event.nodeId}…`) }), [workflowId, nodes])
  const errors = validateProcessing(graph, node.id)
  const operation: Operation = operations[config.operation]
  function change(next: ProcessingConfig) {
    const nextGraph = { ...graph, nodes: graph.nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, dataProcessing: next } } : n) }
    onChange({ processing: next, status: validateProcessing(nextGraph, node.id).length ? 'Needs configuration' : 'Ready' })
    setResults([]); setMessage('')
  }
  async function test() {
    if (!window.ghost || busy) return
    setBusy(true); setResults([]); setMessage('Running local processing…')
    try { setResults(await window.ghost.processing.run({ workflowId, graph, nodeId: node.id })); setMessage('Local test finished.') }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to test node.') }
    finally { setBusy(false) }
  }
  if (config.mode === 'generated') return <RuntimeLogicInspector node={node} nodes={nodes} graph={graph} workflowId={workflowId} onChange={onChange} onSave={onSave} />
  return <div className="processing-inspector" aria-busy={busy}>
    <p className="processing-kicker">DATA PROCESSING · LOCAL EXECUTION</p><label className="editor-field">Processing mode<select value="manual" onChange={() => change({ ...config, mode: 'generated', expectedOutput: { format: 'rows', filename: null } })}><option value="manual">Configure operations manually</option><option value="generated">Generate from actual inputs</option></select></label>
    <label className="editor-field">Name<input value={node.title} onChange={e => onChange({ title: e.target.value })} disabled={busy} /></label>
    <label className="editor-field">Description<textarea value={node.description} onChange={e => onChange({ description: e.target.value })} disabled={busy} /></label>
    <label className="editor-field">Operation<select aria-label="Processing operation" value={config.operation} disabled={busy} onChange={e => { const next = defaultProcessing(e.target.value as OperationName); setRulesText(JSON.stringify(next.rules, null, 2)); setJsonError(''); change(next) }}>{Object.entries(operations).map(([id, op]) => <option key={id} value={id}>{op.label}</option>)}</select></label>
    <h3>Input mapping</h3>
    {operation.inputs.map(port => {
      const candidates = graph.nodes.filter(n => isUpstream(graph, n.id, node.id) && !isUpstream(graph, node.id, n.id)).flatMap(n => outputPorts(n).filter(p => p.type === port.type).map(p => ({ node: n, port: p })))
      const current = config.inputs[port.name]
      return <label className="editor-field" key={port.name}>{port.name} · {port.type}{port.optional ? ' (optional)' : ''}<select aria-label={`Input ${port.name}`} disabled={busy} value={current ? JSON.stringify([current.nodeId, current.output]) : ''} onChange={e => { const inputs = { ...config.inputs }; if (!e.target.value) delete inputs[port.name]; else { const [nodeId, output] = JSON.parse(e.target.value) as string[]; inputs[port.name] = { nodeId, output, type: port.type } }; change({ ...config, inputs }) }}><option value="">Select upstream output</option>{candidates.map(({ node: source, port: output }) => <option key={`${source.id}:${output.name}`} value={JSON.stringify([source.id, output.name])}>{nodes.find(n => n.id === source.id)?.title} → {output.name} ({output.type})</option>)}</select>{!candidates.length && <small>No compatible upstream output. Add this node after a browser download or processing node.</small>}</label>
    })}
    <h3>Processing rules</h3>
    <label className="editor-field">Rules (JSON)<textarea className="processing-rules" aria-label="Processing rules" spellCheck={false} disabled={busy} value={rulesText} onChange={e => { setRulesText(e.target.value); try { const rules = JSON.parse(e.target.value); if (!rules || Array.isArray(rules) || typeof rules !== 'object') throw new Error('Rules must be an object.'); setJsonError(''); change({ ...config, rules }) } catch { setJsonError('Enter a valid JSON object.'); onChange({ status: 'Needs configuration' }) } }} /></label>
    <small className="processing-help">{config.operation === 'detect_missing' ? 'Set key and expectedIds, or map a comparison dataset. IDs are compared with their exact types.' : config.operation === 'compare_datasets' ? 'Returns rows from the first dataset whose keys do not occur in the comparison dataset.' : config.operation === 'find_duplicates' ? 'Returns repeated rows after the first occurrence of each key.' : config.operation === 'conditional' ? 'Returns the input rows when the condition matches, otherwise an empty dataset; matched is also returned.' : config.operation === 'read_files' || config.operation === 'merge_files' ? 'Reads and concatenates all files. Optional sheet selects an Excel worksheet. CSV values remain strings.' : 'Only the selected operation’s validated rules are executed.'}</small>
    <h3>Output configuration</h3>
    {config.operation === 'generate_report' && <label className="editor-field">Report filename<input aria-label="Output filename" disabled={busy} value={config.output?.filename ?? ''} onChange={e => change({ ...config, output: { filename: e.target.value } })} /><small>Use .xlsx, .csv or .json. For an empty dataset, specify columns in the rules.</small></label>}
    <div className="processing-ports">{operation.outputs.map(port => <span key={port.name}>{port.name}: {port.type}</span>)}</div>
    {(jsonError || errors.length > 0) && <div className="processing-errors" role="alert"><strong>Needs configuration</strong><ul>{[...(jsonError ? [jsonError] : []), ...errors].map((error, i) => <li key={i}>{error}</li>)}</ul></div>}
    <div className="processing-actions"><button className="dash-button" disabled={busy || !!jsonError || !!errors.length} onClick={() => void test()}>{busy ? 'Running…' : 'Test Node'}</button><button className="dash-button dash-button--primary" disabled={busy || !!jsonError} onClick={async () => { setBusy(true); try { setMessage(await onSave(config) ? 'Changes saved.' : 'Unable to save changes.') } finally { setBusy(false) } }}>Save Changes</button></div>
    <small className="processing-help">Test Node runs its processing dependencies using the latest successful browser downloads. Files stay on this computer.</small>
    {message && <p role="status">{message}</p>}
    {results.map(result => <section className="processing-result" key={result.nodeId}><strong>{nodes.find(n => n.id === result.nodeId)?.title}: {result.status}</strong>{result.error && <p role="alert">{result.error}</p>}{Object.entries(result.outputs).map(([name, output]) => <div key={name}>{name}: {output.type === 'files' ? output.value.map(file => <button className="text-button" key={file.id} onClick={() => void window.ghost?.processing.reveal(workflowId, file.id).catch(e => setMessage(String(e)))}>{file.name} ({file.bytes} bytes)</button>) : output.type === 'rows' ? <><span>{output.value.length} rows</span><pre>{JSON.stringify(output.value.slice(0, 5), null, 2)}</pre></> : String(output.value)}</div>)}</section>)}
  </div>
}
