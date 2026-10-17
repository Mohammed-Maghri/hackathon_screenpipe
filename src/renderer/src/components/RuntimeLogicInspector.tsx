import { ProcessingRuntimeDetails } from './ProcessingRuntimeDetails'
import { ProcessingProgress, type ProcessingStage } from './ProcessingProgress'
import { useEffect, useState } from 'react'
import { isUpstream, outputPorts, type DataGraph, type ProcessingConfig } from '../../../shared/dataProcessing'
import type { LogicTest } from '../../../shared/processingPlan'
import type { EditorNode } from '../data/editorState'
import { promptConfig } from '../data/promptProcessing'

type Props = {
  node: EditorNode
  nodes: EditorNode[]
  graph: DataGraph
  workflowId: string
  onChange: (patch: Partial<EditorNode>) => void
  onSave: (config: ProcessingConfig) => Promise<boolean>
}

export function RuntimeLogicInspector({ node, nodes, graph, workflowId, onChange, onSave }: Props) {
  const original = node.processing!
  const [needsRegeneration, setNeedsRegeneration] = useState(false)
  const reusable = !!original.approvedPlan && node.status === 'Ready' && !needsRegeneration
  const config = reusable ? original : promptConfig(original, graph, node.id, node.description)
  const expected = config.expectedOutput ?? { format: 'rows' as const, filename: null }
  const [showScript, setShowScript] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<ProcessingStage>('reading')
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [result, setResult] = useState<LogicTest | null>(null)
  const [inspectionId, setInspectionId] = useState<string | null>(null)
  const [showReference, setShowReference] = useState(false)
  const signature = JSON.stringify([node.description, original.inputs, original.expectedOutput, original.inferOutput])
  useEffect(() => { setMessage(''); setResult(null); setFailed(false); setNeedsRegeneration(false) }, [signature])
  const candidates = graph.nodes.filter(n => n.id !== node.id && isUpstream(graph, n.id, node.id) && !isUpstream(graph, node.id, n.id))
    .flatMap(n => outputPorts(n).map(port => ({ node: n, port })))
  const inputNames = [...new Set([...(Object.keys(config.inputs).length ? Object.keys(config.inputs) : ['input']), ...(showReference ? ['reference'] : [])])]
  const sourceNames = [...new Set(Object.values(config.inputs).map(ref => nodes.find(n => n.id === ref.nodeId)?.title ?? ref.nodeId))]

  function change(next: ProcessingConfig) { onChange({ processing: next, status: 'Needs configuration' }) }
  async function task(action: () => Promise<void>) {
    setBusy(true); setMessage(''); setFailed(false)
    try { await action() }
    catch (error) {
      const text = (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
      setFailed(true)
      if (/schema changed|not been tested and approved on this computer/i.test(text)) {
        setNeedsRegeneration(true)
        setMessage(`${text} Run again to generate, test and save updated logic.`)
      } else setMessage(text)
    }
    finally { setBusy(false) }
  }
  async function save() {
    if (!await onSave(config)) throw new Error('Unable to save changes.')
  }
  async function run() {
    setResult(null); setStage(reusable ? 'running' : 'reading'); setMessage('Saving your prompt…')
    await save()
    if (reusable) {
      setMessage('Running saved logic locally…')
      const currentGraph = { ...graph, nodes: graph.nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, dataProcessing: config } } : n) }
      const results = await window.ghost!.processing.run({ workflowId, graph: currentGraph, nodeId: node.id })
      const output = results.find(r => r.nodeId === node.id)
      if (output?.status !== 'VERIFIED') throw new Error(output?.error ?? 'Node did not complete.')
      setInspectionId(null)
      setResult({ status: 'tested', rows: output.outputs.rows?.type === 'rows' ? output.outputs.rows.value.slice(0,20) : [], count: output.outputs.count?.type === 'number' ? output.outputs.count.value : 0, files: output.outputs.files?.type === 'files' ? output.outputs.files.value : [] })
      setMessage('Done. Used saved logic.'); return
    }
    setMessage('Reading the previous node’s output…')
    const inspection = await window.ghost!.runtimeLogic.inspect(workflowId, node.id)
    if (!inspection.id) throw new Error(inspection.error ?? 'Run the previous node first.')
    setInspectionId(inspection.id)
    setStage('generating'); setMessage('Generating processing logic…')
    // The explicit Run action authorizes schema-only generation and saving after a successful local test.
    // Row samples and original files are never sent by this simplified flow.
    const generated = await window.ghost!.runtimeLogic.generate(inspection.id, false, true)
    if (!generated.draft) throw new Error(generated.reason ?? 'Please clarify the prompt.')
    setStage('testing'); setMessage('Running and checking the result locally…')
    const tested = await window.ghost!.runtimeLogic.test(inspection.id, generated.draft.plan)
    if (tested.status !== 'tested' || !tested.testId) throw new Error(tested.error ?? 'The generated logic did not pass its test. Nothing was saved for reuse.')
    setStage('saving'); setMessage('Saving reusable logic…')
    const approved = await window.ghost!.runtimeLogic.approve(inspection.id, tested.testId)
    onChange({ processing: { ...config, approvedPlan: approved }, status: 'Ready' })
    setNeedsRegeneration(false)
    setResult(tested)
    setMessage('Done. Logic saved for future pipeline runs.')
  }

  return <div className="processing-inspector min-w-0 pb-2 text-ink [&_h3]:mt-6 [&_h3]:mb-2.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-ink [&_textarea]:min-h-24 [&_textarea]:resize-y runtime-logic" aria-busy={busy}>
    <p className="processing-kicker font-sans mt-0 mb-3 text-xs text-muted">DATA PROCESSING</p>
    <p className="processing-help block text-xs leading-7 text-muted">Input: {sourceNames.join(', ') || 'Connect a previous node'} · Output: {expected.format === 'rows' ? 'Structured data' : expected.filename}</p>
    <label className="editor-field font-sans my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted">What should happen to this data?
      <textarea className="w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-sans text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50" aria-label="Processing objective" placeholder="For example: convert the downloaded Excel files to CSV and keep only unpaid invoices." value={node.description} disabled={busy} onChange={e => onChange({ description: e.target.value, status: 'Needs configuration' })} />
    </label>
    <p className="processing-help block text-xs leading-7 text-muted">{reusable ? 'Saved logic is ready. Pipeline runs reuse it locally.' : 'Run generates, tests and saves reusable logic. Your prompt and the input schema (column/sheet names and counts) are sent to OpenAI; files and row values stay on this computer.'}</p>
    <div className="processing-actions mt-5 mb-3 flex flex-wrap gap-2.5 [&>.dash-button]:min-h-10">
      <button className="dash-button dash-button--primary" disabled={busy || !node.description.trim() || !Object.keys(config.inputs).length} onClick={() => void task(run)}>{busy ? 'Running…' : 'Run'}</button>
      <button className="dash-button" disabled={busy} onClick={() => void task(async () => { setStage('configuration'); setMessage('Saving your changes…'); await save(); setMessage('Changes saved.') })}>Save Changes</button>
      <button className="dash-button" aria-expanded={showScript} aria-controls="generated-script" onClick={() => setShowScript(!showScript)}>{showScript ? 'Hide script & runtime' : 'View script & runtime'}</button>
    </div>
    {showScript && <ProcessingRuntimeDetails nodeId={node.id} approved={original.approvedPlan} reusable={reusable} />}
    {busy && <ProcessingProgress stage={stage} message={message} />}
    {!busy && message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    {result && <section id="logic-results" className="processing-result border-t border-line py-5 text-sm leading-7 break-words text-subtle [&_pre]:max-h-56 [&_pre]:overflow-auto [&_pre]:rounded-control [&_pre]:border [&_pre]:border-line [&_pre]:bg-canvas [&_pre]:p-3.5 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-7 [&_pre]:text-ink [&>strong]:mb-2 [&>strong]:block [&>strong]:font-medium [&>strong]:text-ink [&>.text-button]:mb-2 [&>.text-button]:block">
      <strong>Done · {result.count} rows</strong>
      {result.files.map(file => <button className="text-button" key={file.id} onClick={() => void (inspectionId ? window.ghost!.runtimeLogic.reveal(inspectionId, file.id) : window.ghost!.processing.reveal(workflowId, file.id)).catch(e => setMessage(String(e)))}>Show {file.name} in folder</button>)}
      <details><summary>Preview data</summary><pre>{JSON.stringify(result.rows, null, 2)}</pre></details>
    </section>}
    <details className="processing-options mt-6 border-y border-line py-3 text-sm text-muted [&>summary]:cursor-pointer [&>summary]:text-subtle" open={!Object.keys(config.inputs).length}>
      <summary>Input & output settings</summary>
      {inputNames.map(name => <label className="editor-field font-sans my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted" key={name}>{name}<select className="w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-sans text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50" aria-label={`Runtime input ${name}`} disabled={busy} value={config.inputs[name] ? JSON.stringify([config.inputs[name].nodeId, config.inputs[name].output]) : ''} onChange={e => {
        const inputs = { ...config.inputs }, selected = candidates.find(c => JSON.stringify([c.node.id, c.port.name]) === e.target.value)
        if (selected) inputs[name] = { nodeId: selected.node.id, output: selected.port.name, type: selected.port.type }; else delete inputs[name]
        change({ ...config, inputs })
      }}><option className="bg-panel text-ink" value="">Choose upstream output</option>{candidates.map(c => <option className="bg-panel text-ink" key={`${c.node.id}:${c.port.name}`} value={JSON.stringify([c.node.id, c.port.name])}>{nodes.find(n => n.id === c.node.id)?.title} → {c.port.name}</option>)}</select></label>)}
      {!config.inputs.reference && <button className="text-button" disabled={busy} onClick={() => setShowReference(true)}>Add reference data</button>}
      <label className="editor-field font-sans my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted">Output format<select className="w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-sans text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50" aria-label="Expected output format" disabled={busy} value={config.inferOutput === false ? expected.format : 'automatic'} onChange={e => {
        const value = e.target.value
        change(value === 'automatic' ? { ...config, inferOutput: true } : { ...config, inferOutput: false, expectedOutput: { format: value as 'rows' | 'csv' | 'xlsx' | 'json', filename: value === 'rows' ? null : `report.${value}` } })
      }}><option className="bg-panel text-ink" value="automatic">From prompt</option><option className="bg-panel text-ink" value="rows">Structured data</option><option className="bg-panel text-ink" value="csv">CSV file</option><option className="bg-panel text-ink" value="xlsx">Excel file</option><option className="bg-panel text-ink" value="json">JSON file</option></select></label>
      {config.inferOutput === false && expected.format !== 'rows' && <label className="editor-field font-sans my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted">File name<input className="w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-sans text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50" disabled={busy} value={expected.filename ?? ''} onChange={e => change({ ...config, expectedOutput: { ...expected, filename: e.target.value } })} /></label>}
      <button className="text-button" disabled={busy} onClick={() => change({ ...config, mode: 'manual' })}>Configure operations manually</button>
    </details>
  </div>
}
