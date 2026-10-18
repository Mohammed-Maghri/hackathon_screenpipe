import type { SavedWorkflowDetail } from './discovery'
export interface ScriptNode {
  nodeId: string; label: string; file: string; kind: string
  dependencies: string[]; inputs: unknown; outputs: unknown
  status: 'runtime_required' | 'blocked'; reason: string
}
export interface ScriptPackage {
  version: 1; workflowId: string; revision: string; fingerprint: string
  createdAt: string; fileHashes?: Record<string,string>; directory: string; nodes: ScriptNode[]; files: string[]
}
export interface WorkflowScriptsAPI {
  latest(workflowId: string): Promise<ScriptPackage | null>
  generate(workflow: SavedWorkflowDetail): Promise<ScriptPackage>
  read(workflowId: string, revision: string, file: string): Promise<string>
  reveal(workflowId: string, revision: string): Promise<void>
}
