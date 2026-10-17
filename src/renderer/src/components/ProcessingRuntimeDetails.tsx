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
  return <section id="generated-script" className="processing-result border-t border-line py-5 text-sm leading-7 break-words text-subtle [&_pre]:max-h-56 [&_pre]:overflow-auto [&_pre]:rounded-control [&_pre]:border [&_pre]:border-line [&_pre]:bg-canvas [&_pre]:p-3.5 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-7 [&_pre]:text-ink [&>strong]:mb-2 [&>strong]:block [&>strong]:font-medium [&>strong]:text-ink [&>.text-button]:mb-2 [&>.text-button]:block" aria-label="Script and runtime details">
    <strong>How this node runs</strong>
    <dl className="processing-runtime-facts grid grid-cols-[100px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm leading-6 text-subtle [&>dt]:text-muted [&>dd]:m-0 [&>dd]:break-words max-[520px]:grid-cols-1 max-[520px]:gap-1 max-[520px]:[&>dd]:mb-2 [&>dt]:font-sans [&>dt]:text-xs">
      <dt>Language</dt><dd>TypeScript, compiled to JavaScript. No Python installation needed.</dd>
      <dt>Runtime</dt><dd>Electron / Node.js worker on this computer. Runs when the pipeline reaches this node, then stops.</dd>
      <dt>Saved logic</dt><dd>{approved ? `JSON processing plan · version ${approved.version}` : 'Run this node to generate, test and save its processing plan.'}</dd>
      <dt>AI usage</dt><dd>Generates the plan initially or when you regenerate it. Future runs execute the saved plan without calling AI. Ghost still retrieves workflow configuration from the backend.</dd>
    </dl>
    <p className="processing-help block text-xs leading-7 text-muted">Ghost resolves the previous node’s verified outputs, checks their schema, executes the saved steps locally and passes results to the next node. Export steps save files on this computer; use “Show in folder” in the results to find them.</p>
    {approved && !reusable && <p className="processing-help block text-xs leading-7 text-muted">The saved plan needs review or regeneration before reuse with the current configuration.</p>}
    <label className="editor-field font-sans my-5 grid gap-2 text-xs text-subtle [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted">View source
      <select className="w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-2.5 font-sans text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-50" aria-label="Processing source" value={selected} onChange={e => { setSelected(e.target.value as typeof selected); setMessage('') }}>
        {Object.entries(sources).map(([key, source]) => <option className="bg-panel text-ink" key={key} value={key}>{source.label}</option>)}
        <option className="bg-panel text-ink" value="plan" disabled={!approved}>JSON · This node’s saved plan{approved ? ` (v${approved.version})` : ' (not generated yet)'}</option>
      </select>
    </label>
    <p className="processing-help block text-xs leading-7 text-muted">{selected === 'plan' ? 'These are the saved instructions for this node, executed by the TypeScript engine.' : 'Actual source bundled with Ghost. This shared engine executes your node’s saved plan. Downloaded source depends on the rest of Ghost; it is not a standalone script.'}</p>
    <pre className="processing-rules min-h-40 font-mono text-xs leading-7 [tab-size:2]" tabIndex={0} aria-label={file.name}>{file.text}</pre>
    <div className="generated-script-actions mt-4 flex flex-wrap gap-2">
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
