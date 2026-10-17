import type { SavedWorkflowDetail, WorkflowUpdate } from '../../../shared/discovery'
import { defaultProcessing } from '../../../shared/dataProcessing'
import type { EditorNode } from './editorState'

export function workflowPayload(workflow: SavedWorkflowDetail, title: string, nodes: EditorNode[], connections: string[][], edgeIds: Map<string, string>): WorkflowUpdate {
  return {
    name: title,
    nodes: nodes.map((node, index) => {
      const original = workflow.nodes.find(item => item.id === node.id)
      return {
        id: node.id, label: node.title,
        type: node.kind === 'Data Processing' ? (node.processing?.operation === 'generate_report' ? 'OUTPUT' : 'TRANSFORM') : node.kind === 'AI logic' ? 'TRANSFORM' : node.kind === 'Human review' ? 'CONDITION' : original?.type ?? 'ACTION',
        positionX: node.x, positionY: node.y,
        config: {
          ...original?.config, outputCapture: node.outputCapture ?? {}, contract: node.kind === 'Data Processing' ? null : node.contract ?? null,
          ...(node.kind === 'Data Processing' ? { dataProcessing: node.processing ?? defaultProcessing(), executor: 'local' } : {}),
          stepType: node.kind === 'Data Processing' ? 'data_processing' : node.kind === 'Integration action' ? 'integration' : node.kind === 'AI logic' ? 'logic' : node.kind === 'Human review' ? 'review' : node.kind === 'Browser action' ? 'browser' : node.kind === 'Application action' ? 'application' : original?.config.stepType,
          order: index, description: node.description, startUrl: node.startUrl ?? null, instructions: node.instructions, application: node.app ?? null,
          status: node.status === 'Learned' ? 'learned' : node.status === 'Recorded' ? 'recorded' : node.status === 'Ready' ? 'ready' : node.status === 'Needs teaching' ? 'needs_recording' : 'needs_configuration',
        },
      }
    }),
    edges: connections.filter(([from, to]) => nodes.some(node => node.id === from) && nodes.some(node => node.id === to)).map(([sourceNodeId, targetNodeId]) => {
      const key = `${sourceNodeId}:${targetNodeId}`
      const id = workflow.edges.find(edge => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId)?.id ?? edgeIds.get(key) ?? crypto.randomUUID()
      edgeIds.set(key, id)
      return { id, sourceNodeId, targetNodeId }
    }),
  }
}
