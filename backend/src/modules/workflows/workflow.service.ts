import { configureNodeContracts } from './node-contract.js'
import type { Database } from '../../database/client.js'
import { Prisma } from '../../generated/prisma/client.js'
import { ApiError } from '../../errors/handler.js'
import type { CreateWorkflow, UpdateWorkflow, ListWorkflows } from './workflow.schemas.js'
const include = { nodes: { orderBy: { id: 'asc' as const } }, edges: { orderBy: { id: 'asc' as const } } }
export class WorkflowService {
  constructor(private readonly db: Database) {}
  async list(query: ListWorkflows) {
    const where: Prisma.WorkflowWhereInput = { status: query.status, ownerId: query.ownerId, ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] } : {}) }
    const [items, total] = await this.db.$transaction([
      this.db.workflow.findMany({ where, skip: query.offset, take: query.limit, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: { _count: { select: { nodes: true, edges: true } }, nodes: { select: { config: true } } } }),
      this.db.workflow.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
    return { items: items.map(({ nodes, ...workflow }) => ({ ...workflow, applications: [...new Set(nodes.flatMap(node => {
      const config = node.config
      return config && typeof config === 'object' && !Array.isArray(config) && typeof config.application === 'string' ? [config.application] : []
    }))], applicationIcons: [...new Set(nodes.flatMap(node => {
      const config = node.config
      if (!config || typeof config !== 'object' || Array.isArray(config)) return []
      if (config.stepType === 'browser') return ['Chrome']
      return typeof config.application === 'string' ? [config.application] : []
    }))] })), total, limit: query.limit, offset: query.offset }
  }
  async find(id: string) { return this.db.workflow.findUnique({ where: { id }, include }) }
  async get(id: string) { return this.db.workflow.findUniqueOrThrow({ where: { id }, include }) }
  async create(data: CreateWorkflow, id?: string) {
    return this.db.$transaction(async tx => {
      const { edges, ...metadataWithNodes } = data
      let nodes = metadataWithNodes.nodes
      const { nodes: _nodes, ...metadata } = metadataWithNodes
      try { if (nodes && edges) nodes = configureNodeContracts(nodes, edges) } catch { throw new ApiError(400, 'INVALID_NODE_CONTRACT', 'Invalid node inputs, outputs or bindings.') }
      const workflow = await tx.workflow.create({ data: { ...metadata, ...(id ? { id } : {}) } })
      if (nodes.length) await tx.workflowNode.createMany({ data: nodes.map(node => ({ ...node, config: node.config as Prisma.InputJsonObject, workflowId: workflow.id })) })
      if (edges.length) await tx.workflowEdge.createMany({ data: edges.map(edge => ({ ...edge, workflowId: workflow.id })) })
      return tx.workflow.findUniqueOrThrow({ where: { id: workflow.id }, include })
    })
  }
  async update(id: string, data: UpdateWorkflow, expectedUpdatedAt?: Date) {
    return this.db.$transaction(async tx => {
      const { edges, ...metadataWithNodes } = data
      let nodes = metadataWithNodes.nodes
      const { nodes: _nodes, ...metadata } = metadataWithNodes
      try { if (nodes && edges) nodes = configureNodeContracts(nodes, edges) } catch { throw new ApiError(400, 'INVALID_NODE_CONTRACT', 'Invalid node inputs, outputs or bindings.') }
      if (expectedUpdatedAt) {
        const changed = await tx.workflow.updateMany({ where: { id, updatedAt: expectedUpdatedAt }, data: { ...metadata, updatedAt: new Date() } })
        if (!changed.count) throw new ApiError(409, 'WORKFLOW_CHANGED', 'Workflow changed while defining inputs. Retry.')
      } else await tx.workflow.update({ where: { id }, data: { ...metadata, updatedAt: new Date() } })
      if (nodes && edges) {
        // Freeze graphs with execution history until workflow versioning exists.
        if (await tx.workflowRun.count({ where: { workflowId: id } })) throw new ApiError(409, 'RUN_HISTORY_EXISTS', 'Graphs with run history cannot be replaced')
        await tx.workflowEdge.deleteMany({ where: { workflowId: id } })
        await tx.workflowNode.deleteMany({ where: { workflowId: id } })
        if (nodes.length) await tx.workflowNode.createMany({ data: nodes.map(node => ({ ...node, config: node.config as Prisma.InputJsonObject, workflowId: id })) })
        if (edges.length) await tx.workflowEdge.createMany({ data: edges.map(edge => ({ ...edge, workflowId: id })) })
      }
      return tx.workflow.findUniqueOrThrow({ where: { id }, include })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }
  async saveNodeLogic(workflowId: string, nodeId: string, patch: Record<string, unknown>, expectedUpdatedAt: Date) {
    return this.db.$transaction(async tx => {
      const changed = await tx.workflow.updateMany({ where: { id: workflowId, updatedAt: expectedUpdatedAt }, data: { updatedAt: new Date() } })
      if (!changed.count) throw new ApiError(409, 'WORKFLOW_CHANGED', 'Workflow changed. Reinspect before generating or approving.')
      const node = await tx.workflowNode.findFirstOrThrow({ where: { id: nodeId, workflowId } })
      return tx.workflowNode.update({ where: { id: nodeId }, data: { config: { ...(node.config as Prisma.JsonObject), ...patch } as Prisma.InputJsonObject } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }
  async delete(id: string) {
    await this.db.$transaction(async tx => {
      // Delete dependent history first; NodeRun restricts deleting referenced nodes.
      await tx.workflowRun.deleteMany({ where: { workflowId: id } })
      await tx.workflow.delete({ where: { id } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }
}
