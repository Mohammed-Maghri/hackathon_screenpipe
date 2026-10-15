import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { graphSchema, isUpstream, type ProcessingRequest, type ProcessingResult, type ProcessingEvent } from '../../shared/dataProcessing'
import { DataProcessingExecutor, LocalArtifacts } from './executor'
import { verifiedBrowserOutputs } from './browserOutputs'
import type { DataValue, ProcessingConfig } from '../../shared/dataProcessing'

const requestSchema = z.object({ workflowId: z.string().min(1).max(200), graph: graphSchema, nodeId: z.string().optional() }).strict()
export class LocalProcessingService {
  generatedExecutor?: (workflowId: string, nodeId: string, config: ProcessingConfig, inputs: Record<string,DataValue>, artifacts: LocalArtifacts) => Promise<Record<string,DataValue>>
  private stores = new Map<string, LocalArtifacts>()
  private busy = new Set<string>()
  constructor(private userData: string) {}
  private directory(workflowId: string) { return join(this.userData, 'processing', createHash('sha256').update(workflowId).digest('hex')) }
  async run(input: ProcessingRequest, onStatus: (event: ProcessingEvent) => void = () => {}): Promise<ProcessingResult[]> {
    const { workflowId, graph, nodeId } = requestSchema.parse(input)
    if (this.busy.has(workflowId)) throw new Error('This workflow is already processing.')
    const ids = new Set(graph.nodes.map(n => n.id))
    if (ids.size !== graph.nodes.length || graph.edges.some(e => !ids.has(e.sourceNodeId) || !ids.has(e.targetNodeId) || e.sourceNodeId === e.targetNodeId)) throw new Error('Invalid workflow graph.')
    if (nodeId && !graph.nodes.some(n => n.id === nodeId && n.config.stepType === 'data_processing')) throw new Error('Unknown processing node.')
    if (graph.nodes.some(n => isUpstream(graph, n.id, n.id))) throw new Error('Workflow contains a cycle.')
    this.busy.add(workflowId)
    try {
      const artifacts = this.stores.get(workflowId) ?? new LocalArtifacts(this.directory(workflowId))
      this.stores.set(workflowId, artifacts)
      const executor = new DataProcessingExecutor(artifacts)
      const pending = graph.nodes.filter(n => n.config.stepType === 'data_processing' && (!nodeId || n.id === nodeId || isUpstream(graph, n.id, nodeId)))
      const results: ProcessingResult[] = [], sourceErrors = new Map<string, string>()
      for (const source of graph.nodes.filter(n => n.config.stepType === 'browser' && pending.some(p => isUpstream(graph,n.id,p.id)))) {
        try {
          executor.outputs.set(source.id, await verifiedBrowserOutputs(this.userData, workflowId, source.id, artifacts))
        } catch (error) { sourceErrors.set(source.id, error instanceof Error ? error.message : 'Unable to load browser downloads.') }
      }
      while (pending.length) {
        const index = pending.findIndex(n => !pending.some(other => other.id !== n.id && isUpstream(graph, other.id, n.id)))
        if (index < 0) throw new Error('Cyclic processing dependencies.')
        const node = pending.splice(index, 1)[0]
        const failed = results.find(r => r.status !== 'VERIFIED' && isUpstream(graph, r.nodeId, node.id))
        const sourceError = [...sourceErrors].find(([id]) => isUpstream(graph, id, node.id))
        onStatus({ workflowId, nodeId: node.id, status: 'RUNNING' })
        results.push(failed ? { nodeId: node.id, status: 'SKIPPED', outputs: {}, error: `Upstream node ${failed.nodeId} failed.` } : sourceError ? { nodeId: node.id, status: 'FAILED', outputs: {}, error: sourceError[1] } : node.config.dataProcessing?.mode === 'generated' ? await this.executeGenerated(workflowId, node.id, node.config.dataProcessing, executor) : await executor.execute(graph, node.id))
        const result = results[results.length - 1]
        onStatus({ workflowId, nodeId: node.id, status: result.status, error: result.error })
      }
      await mkdir(this.directory(workflowId), { recursive: true, mode: 0o700 })
      await writeFile(join(this.directory(workflowId), `${randomUUID()}.json`), JSON.stringify({ startedFrom: nodeId ?? null, finishedAt: new Date().toISOString(), results, artifacts: artifacts.snapshot() }), { mode: 0o600 })
      return results
    } finally { this.busy.delete(workflowId) }
  }
  private async executeGenerated(workflowId:string,nodeId:string,config:ProcessingConfig,executor:DataProcessingExecutor):Promise<ProcessingResult>{
    try{
      if(!this.generatedExecutor)throw new Error('Generated-plan executor unavailable.')
      const inputs:Record<string,DataValue>={}
      for(const [name,ref] of Object.entries(config.inputs)){const value=executor.outputs.get(ref.nodeId)?.[ref.output];if(!value||value.type!==ref.type)throw new Error(`Verified input unavailable: ${name}`);inputs[name]=value}
      const outputs=await this.generatedExecutor(workflowId,nodeId,config,inputs,executor.artifacts)
      executor.outputs.set(nodeId,outputs)
      return {nodeId,status:'VERIFIED',outputs}
    }catch(e){executor.outputs.delete(nodeId);return {nodeId,status:'FAILED',outputs:{},error:e instanceof Error?e.message:'Processing failed.'}}
  }
  async path(workflowId: string, id: string) {
    const store = this.stores.get(workflowId)
    if (!store) throw new Error('Run the processing node to load its output files.')
    return store.getPath(id)
  }
}
