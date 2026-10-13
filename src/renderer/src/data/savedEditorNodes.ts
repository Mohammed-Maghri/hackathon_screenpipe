import type { SavedWorkflowDetail } from '../../../shared/discovery'
import type { NodeContract } from '../../../shared/nodeContract'
import type { EditorNode } from './editorState'
import type { AppName } from './workflows'

export function savedEditorNodes(workflow: SavedWorkflowDetail): EditorNode[] {
  const knownApps = ['Microsoft', 'Google', 'Slack', 'Notion', 'Excel', 'Gmail', 'Drive', 'Chrome', 'Screenpipe']
  return workflow.nodes.map(node => ({
    id: node.id, title: node.label,
    kind: ({ browser: 'Browser action', application: 'Application action', logic: 'AI logic', review: 'Human review' } as Record<string, string>)[String(node.config.stepType)] ?? node.type,
    description: typeof node.config.description === 'string' ? node.config.description : '',
    contract: node.config.contract ? node.config.contract as NodeContract : undefined,
    app: knownApps.includes(String(node.config.application)) ? node.config.application as AppName : undefined,
    status: node.config.status === 'learned' ? 'Learned' : node.config.status === 'recorded' ? 'Recorded' : node.config.status === 'ready' ? 'Ready' : node.config.status === 'needs_recording' ? 'Needs teaching' : 'Needs configuration',
    instructions: Array.isArray(node.config.instructions) ? node.config.instructions.filter((item): item is string => typeof item === 'string') : [],
    startUrl: typeof node.config.startUrl === 'string' ? node.config.startUrl : null,
    x: node.positionX, y: node.positionY,
  }))
}
