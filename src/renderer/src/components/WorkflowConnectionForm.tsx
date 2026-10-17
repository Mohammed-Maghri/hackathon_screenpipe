import { useId, useState, type FormEvent } from 'react'
import { workflowConnectionError } from '../data/workflowConnections'
import { ArrowRight } from './ImageIcon'

type NodeChoice = { id: string; title: string }
export function WorkflowConnectionForm({ nodes, connections, selectedId, onAdd, onCancel }: {
  nodes: NodeChoice[];
  connections: string[][];
  selectedId: string;
  onAdd: (source: string, target: string) => void;
  onCancel: () => void;
}) {
  const fieldId = useId()
  const [source, setSource] = useState(nodes.some(node => node.id === selectedId) ? selectedId : nodes[0]?.id ?? '')
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problem = workflowConnectionError(nodes, connections, source, target)
    if (problem) { setError(problem); return }
    onAdd(source, target)
  }
  return <form onSubmit={submit} className="workflow-form">
    <p className="modal-copy">Choose which node runs first and which node follows it.</p>
    {nodes.length < 2 ? <p className="text-sm leading-6 text-muted">Add at least two nodes before connecting them.</p> : <>
      <label htmlFor={`${fieldId}-source`}>From node</label>
      <select id={`${fieldId}-source`} aria-describedby={error ? `${fieldId}-error` : undefined} value={source} onChange={event => { setSource(event.target.value); setError('') }} className="mt-2 w-full rounded-control border border-strong bg-panel px-3 py-2.5 font-sans text-sm">
        {nodes.map(node => <option key={node.id} value={node.id}>{node.title}</option>)}
      </select>
      <label htmlFor={`${fieldId}-target`}>To node</label>
      <select id={`${fieldId}-target`} aria-describedby={error ? `${fieldId}-error` : undefined} value={target} onChange={event => { setTarget(event.target.value); setError('') }} required className="mt-2 w-full rounded-control border border-strong bg-panel px-3 py-2.5 font-sans text-sm">
        <option value="" disabled>Choose a destination</option>
        {nodes.map(node => <option key={node.id} value={node.id}>{node.title}</option>)}
      </select>
      {error && <p id={`${fieldId}-error`} role="alert" className="mt-3 text-sm leading-6">{error}</p>}
    </>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button type="button" className="dash-button" onClick={onCancel}>Cancel</button>
      {nodes.length >= 2 && <button type="submit" className="dash-button dash-button--primary">Add connection <ArrowRight size={15} /></button>}
    </div>
  </form>
}
