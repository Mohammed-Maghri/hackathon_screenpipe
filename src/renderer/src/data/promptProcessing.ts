import { outputPorts, type DataGraph, type ProcessingConfig } from '../../../shared/dataProcessing'
import type { ExpectedOutput } from '../../../shared/processingPlan'

export function inferPromptOutput(prompt: string): ExpectedOutput {
  const named = prompt.match(/\b(?:export|save|generate|create|produce|write)(?:\s+(?:as|to|named|called))?\s+["']?([a-zA-Z0-9][a-zA-Z0-9 _-]{0,80}\.(xlsx|csv|json))\b/i)
  if (named) return { format: named[2].toLowerCase() as 'xlsx' | 'csv' | 'json', filename: named[1].replace(/\.(xlsx|csv|json)$/i, extension => extension.toLowerCase()) }
  const format = prompt.match(/\b(?:to|as|into|generate|create|export|save|return)\s+(?:(?:an?|the)\s+)?(csv|xlsx|excel|json)\b/i)?.[1].toLowerCase()
  const output = format === 'excel' ? 'xlsx' : format as 'csv' | 'xlsx' | 'json' | undefined
  return output ? { format: output, filename: `report.${output}` } : { format: 'rows', filename: null }
}

export function promptConfig(config: ProcessingConfig, graph: DataGraph, nodeId: string, prompt: string): ProcessingConfig {
  let inputs = config.inputs
  if (!Object.keys(inputs).length) {
    const sources = graph.nodes.filter(n => graph.edges.some(e => e.sourceNodeId === n.id && e.targetNodeId === nodeId))
    // A branch needs an explicit choice; never silently pick one of several predecessors.
    if (sources.length === 1) {
      const ports = outputPorts(sources[0])
      const port = ports.find(p => p.type === (sources[0].config.stepType === 'browser' ? 'files' : 'rows')) ?? ports.find(p => ['files', 'rows', 'text', 'json'].includes(p.type))
      if (port) inputs = { input: { nodeId: sources[0].id, output: port.name, type: port.type } }
    }
  }
  return { ...config, mode: 'generated', inputs, expectedOutput: config.inferOutput === false ? config.expectedOutput ?? { format: 'rows', filename: null } : inferPromptOutput(prompt) }
}
