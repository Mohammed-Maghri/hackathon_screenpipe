export interface DiscoveryRequest {
  prompt: string
  timeRange: 'Last 24 hours' | 'Last 7 days' | 'Last 30 days'
}
export type DiscoveryPreparation = { ok: true } | { ok: false; error: string }
export interface SavedWorkflow {
  applications?: string[]
  applicationIcons?: string[]
  id: string
  name: string
  description: string | null
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  updatedAt: string
  _count: { nodes: number; edges: number }
}
export interface SavedWorkflowDetail extends Omit<SavedWorkflow, '_count'> {
  nodes: { id: string; label: string; type: string; positionX: number; positionY: number; config: Record<string, unknown> }[]
  edges: { id: string; sourceNodeId: string; targetNodeId: string }[]
}
export type WorkflowListResult = { ok: true; items: SavedWorkflow[]; total: number } | { ok: false; error: string }
export type WorkflowDetailResult = { ok: true; workflow: SavedWorkflowDetail } | { ok: false; error: string }
export interface GenerateWorkflowRequest extends DiscoveryRequest { requestId: string }
export interface WorkflowUpdate {
  name: string
  nodes: SavedWorkflowDetail['nodes']
  edges: SavedWorkflowDetail['edges']
}

export interface WorkflowListOptions { limit?: number; status?: SavedWorkflow['status']; search?: string }
export interface WorkflowCreate { name: string; description: string }

export interface DiscoveryProgress { requestId: string; phase: 'activity' | 'ai' | 'saving' }
