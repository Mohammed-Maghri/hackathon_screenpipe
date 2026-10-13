import type { AppName, Workflow } from './workflows'
export type NodeStatus = 'Ready' | 'Needs teaching' | 'Needs configuration'
export type EditorNode = { startUrl?: string | null; id: string; title: string; kind: string; description: string; app?: AppName; status: NodeStatus; instructions: string[]; x: number; y: number }
const initialNodes: EditorNode[] = [
  { id: 'trigger', title: 'Trigger', kind: 'Every day at 9:00', description: 'Start this workflow every morning.', status: 'Ready', instructions: ['Run every day at 9:00'], x: 75, y: 100 },
  { id: 'slack', title: 'Read Slack Reports', kind: 'Browser action', description: 'Open #reports, read the daily summary messages.', app: 'Slack', status: 'Needs teaching', instructions: ['Open Slack (web or app)', 'Go to #reports channel', 'Read the latest messages', 'Extract key information'], x: 310, y: 90 },
  { id: 'dashboard', title: 'Open Dashboard', kind: 'Browser action', description: 'Go to company dashboard and extract key metrics.', app: 'Chrome', status: 'Ready', instructions: ['Open the company dashboard', 'Collect the daily metrics'], x: 600, y: 98 },
  { id: 'process', title: 'Process Data', kind: 'Transform', description: 'Clean and structure the extracted data.', status: 'Ready', instructions: ['Combine the reports and dashboard metrics', 'Remove duplicates and format the data'], x: 720, y: 265 },
  { id: 'excel', title: 'Generate Excel', kind: 'Output', description: 'Create and format the daily report.', app: 'Excel', status: 'Needs configuration', instructions: ['Create a spreadsheet', 'Add the daily report', 'Choose the output folder'], x: 400, y: 385 },
  { id: 'email', title: 'Send Email', kind: 'Output', description: 'Send the report to the team.', app: 'Gmail', status: 'Ready', instructions: ['Attach the generated report', 'Choose recipients', 'Prepare the email for review'], x: 720, y: 415 },
]
export const edges = [['trigger', 'slack'], ['slack', 'dashboard'], ['dashboard', 'process'], ['process', 'excel'], ['excel', 'email']]
export function makeNodes(workflow: Workflow): EditorNode[] {
  if (workflow.id === 'orders') return initialNodes.map(node => ({ ...node, instructions: [...node.instructions] }))
  return [{ ...initialNodes[0], instructions: [...initialNodes[0].instructions] }, ...workflow.steps.map((step, index) => ({ id: `step-${index}`, title: step, kind: 'Browser action', description: step, app: workflow.apps[index % workflow.apps.length], status: 'Needs teaching' as NodeStatus, instructions: [step], x: 310 + (index % 2) * 300, y: 90 + Math.floor(index / 2) * 190 }))]
}

export const editorSnapshots = new Map<string, { nodes: EditorNode[]; title: string }>()
