import type { Database } from '../../database/client.js'
import { Prisma } from '../../generated/prisma/client.js'
import { ApiError } from '../../errors/handler.js'
import type { CreateWorkflow, UpdateWorkflow, ListWorkflows } from './workflow.schemas.js'
const include = { nodes: { orderBy: { id: 'asc' as const } }, edges: { orderBy: { id: 'asc' as const } } }
export class WorkflowService {
  constructor(private readonly db: Database) {}
  async list(query: ListWorkflows) {
    const where = { status: query.status, ownerId: query.ownerId }
    const [items, total] = await this.db.$transaction([
      this.db.workflow.findMany({ where, skip: query.offset, take: query.limit, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: { _count: { select: { nodes: true, edges: true } } } }),
      this.db.workflow.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
    return { items, total, limit: query.limit, offset: query.offset }
  }
  async get(id: string) { return this.db.workflow.findUniqueOrThrow({ where: { id }, include }) }
  async create(data: CreateWorkflow) {
    return this.db.$transaction(async tx => {
      const { nodes, edges, ...metadata } = data
      const workflow = await tx.workflow.create({ data: metadata })
      if (nodes.length) await tx.workflowNode.createMany({ data: nodes.map(node => ({ ...node, config: node.config as Prisma.InputJsonObject, workflowId: workflow.id })) })
      if (edges.length) await tx.workflowEdge.createMany({ data: edges.map(edge => ({ ...edge, workflowId: workflow.id })) })
      return tx.workflow.findUniqueOrThrow({ where: { id: workflow.id }, include })
    })
  }
  async update(id: string, data: UpdateWorkflow) {
    return this.db.$transaction(async tx => {
      const { nodes, edges, ...metadata } = data
      await tx.workflow.update({ where: { id }, data: { ...metadata, updatedAt: new Date() } })
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
  async delete(id: string) {
    await this.db.$transaction(async tx => {
      // Delete dependent history first; NodeRun restricts deleting referenced nodes.
      await tx.workflowRun.deleteMany({ where: { workflowId: id } })
      await tx.workflow.delete({ where: { id } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }
}
