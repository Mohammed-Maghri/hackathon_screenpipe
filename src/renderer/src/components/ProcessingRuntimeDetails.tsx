import { useState } from 'react'
import type { ProcessingConfig } from '../../../shared/dataProcessing'
import planExecutor from '../../../main/dataProcessing/planExecutor.ts?raw'
import operations from '../../../main/dataProcessing/executor.ts?raw'
import worker from '../../../main/dataProcessing/runWorker.ts?raw'

const sources = {
  executor: { name: 'planExecutor.ts', label: 'TypeScript · Plan executor', text: planExecutor },
  operations: { name: 'executor.ts', label: 'TypeScript · File conversion & operations', text: operations },
  worker: { name: 'runWorker.ts', label: 'TypeScript · Background worker launcher', text: worker },
}

export function ProcessingRuntimeDetails({ nodeId, approved, reusable }: {
  nodeId: string
  approved: ProcessingConfig['approvedPlan']
  reusable: boolean
}) {
  const [selected, setSelected] = useState<keyof typeof sources | 'plan'>('executor')
  const [message, setMessage] = useState('')
  const file = selected === 'plan'
    ? { name: `processing-${nodeId}-v${approved?.version ?? 0}.json`, text: approved ? JSON.stringify(approved.plan, null, 2) : '' }
    : sources[selected]
  return <section id="generated-script" className="processing-result" aria-label="Script and runtime details">
    <strong>How this node runs</strong>
    <dl className="processing-runtime-facts">
      <dt>Language</dt><dd>TypeScript, compiled to JavaScript. No Python installation needed.</dd>
      <dt>Runtime</dt><dd>Electron / Node.js worker on this computer. Runs when the pipeline reaches this node, then stops.</dd>
      <dt>Saved logic</dt><dd>{approved ? `JSON processing plan · version ${approved.version}` : 'Run this node to generate, test and save its processing plan.'}</dd>
      <dt>AI usage</dt><dd>Generates the plan initially or when you regenerate it. Future runs execute the saved plan without calling AI. Ghost still retrieves workflow configuration from the backend.</dd>
    </dl>
    <p className="processing-help">Ghost resolves the previous node’s verified outputs, checks their schema, executes the saved steps locally and passes results to the next node. Export steps save files on this computer; use “Show in folder” in the results to find them.</p>
    {approved && !reusable && <p className="processing-help">The saved plan needs review or regeneration before reuse with the current configuration.</p>}
    <label className="editor-field">View source
      <select aria-label="Processing source" value={selected} onChange={e => { setSelected(e.target.value as typeof selected); setMessage('') }}>
        {Object.entries(sources).map(([key, source]) => <option key={key} value={key}>{source.label}</option>)}
        <option value="plan" disabled={!approved}>JSON · This node’s saved plan{approved ? ` (v${approved.version})` : ' (not generated yet)'}</option>
      </select>
    </label>
    <p className="processing-help">{selected === 'plan' ? 'These are the saved instructions for this node, executed by the TypeScript engine.' : 'Actual source bundled with Ghost. This shared engine executes your node’s saved plan. Downloaded source depends on the rest of Ghost; it is not a standalone script.'}</p>
    <pre className="processing-rules" tabIndex={0} aria-label={file.name}>{file.text}</pre>
    <div className="generated-script-actions">
      <button className="dash-button" onClick={() => void navigator.clipboard.writeText(file.text).then(() => setMessage('Copied.')).catch(() => setMessage('Unable to copy. Select the source above or download it.'))}>Copy source</button>
      <button className="dash-button" onClick={() => {
        const url = URL.createObjectURL(new Blob([file.text + '\n'], { type: selected === 'plan' ? 'application/json' : 'text/plain' }))
        const link = document.createElement('a'); link.href = url; link.download = file.name
        document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }}>Download source</button>
    </div>
    {message && <p role="status">{message}</p>}
  </section>
}
