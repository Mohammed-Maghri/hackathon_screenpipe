import type { ContractField, NodeContract } from '../../../shared/nodeContract'
export function NodeDataContract({ contract, nodes, kind }: { kind: string; contract?: NodeContract; nodes: { id: string; title: string }[] }) {
  const field = (item: ContractField) => <><strong>{item.name}</strong><small>{item.type === 'array' ? `List of ${item.itemType}` : item.type} · {item.required ? 'Required' : 'Optional'}</small><p>{item.description}</p>{item.fields.length > 0 && <ul>{item.fields.map(property => <li key={property.name}><strong>{property.name}</strong> ({property.type}{property.required ? ', required' : ''}) — {property.description}</li>)}</ul>}</>
  return <section className="node-data-contract mt-6 border-t border-line pt-2 text-sm leading-6 text-subtle [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:font-medium [&_h4]:text-ink [&_ul]:list-disc [&_ul]:pl-5" aria-label="Inputs, outputs and validation">
    <h3>Inputs &amp; outputs</h3>
    <p>{kind === 'AI logic' ? 'AI processes the data supplied by previous steps using this node’s description.' : kind === 'Human review' ? 'A person reviews this result and decides whether to continue.' : 'This step passes its results to later steps without AI processing.'}</p>
    {!contract ? <p>Use “Define inputs &amp; outputs” to generate the data this step needs and produces from its description.</p> : <>
      <h4>Inputs</h4>{contract.inputs.length ? contract.inputs.map(input => <div className="contract-field border-b border-line py-3 [&>small]:block [&>small]:text-muted [&>p]:my-1.5 [&>small]:font-mono [&>small]:text-xs" key={input.name}>{field(input)}<p className="contract-source font-mono text-xs text-muted">From: {input.sourceStepId ? `${nodes.find(node => node.id === input.sourceStepId)?.title ?? 'Missing step'} → ${input.sourceOutput}` : 'Workflow input'}</p></div>) : <p>No input data required.</p>}
      <h4>Outputs</h4>{contract.outputs.length ? contract.outputs.map(output => <div className="contract-field border-b border-line py-3 [&>small]:block [&>small]:text-muted [&>p]:my-1.5 [&>small]:font-mono [&>small]:text-xs" key={output.name}>{field(output)}</div>) : <p>No output data defined.</p>}
      <h4>Validation</h4><ul>{contract.validationCriteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul>
      <p>{contract.requiresHumanReview ? 'Human review required before continuing.' : 'Continue after validation passes.'}</p>
    </>}
  </section>
}
