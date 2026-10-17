import { browserInstructions } from '../../../shared/browserInstructions'
import type { SavedWorkflowDetail } from '../../../shared/discovery'
import type { NodeContract } from '../../../shared/nodeContract'
import type { EditorNode } from './editorState'
import type { AppName } from './workflows'

export function savedEditorNodes(workflow: SavedWorkflowDetail): EditorNode[] {
  const knownApps = ['Microsoft', 'Google', 'Slack', 'Notion', 'Excel', 'Gmail', 'Drive', 'Chrome', 'Screenpipe']
  return [...workflow.nodes].sort((a, b) => (typeof a.config.order === 'number' ? a.config.order : 0) - (typeof b.config.order === 'number' ? b.config.order : 0)).map(node => ({
    outputCapture: node.config.outputCapture as EditorNode['outputCapture'],
    id: node.id, title: node.label,
    kind: ({ trigger: 'Trigger', data_processing: 'Data Processing', integration: 'Integration action', browser: 'Browser action', application: 'Application action', logic: 'AI logic', review: 'Human review' } as Record<string, string>)[String(node.config.stepType)] ?? node.type,
    description: typeof node.config.description === 'string' ? node.config.description : '',
    processing: node.config.stepType === 'data_processing' ? node.config.dataProcessing as import('../../../shared/dataProcessing').ProcessingConfig : undefined,
    contract: node.config.contract ? node.config.contract as NodeContract : undefined,
    app: knownApps.includes(String(node.config.application)) ? node.config.application as AppName : undefined,
    status: node.config.status === 'learned' ? 'Learned' : node.config.status === 'recorded' ? 'Recorded' : node.config.status === 'ready' ? 'Ready' : node.config.status === 'needs_recording' ? 'Needs teaching' : 'Needs configuration',
    instructions: browserInstructions(Array.isArray(node.config.instructions) ? node.config.instructions.filter((item): item is string => typeof item === 'string') : [], node.config.stepType === 'browser' && typeof node.config.startUrl === 'string' ? node.config.startUrl : undefined),
    startUrl: typeof node.config.startUrl === 'string' ? node.config.startUrl : null,
    x: node.positionX, y: node.positionY,
  }))
}
