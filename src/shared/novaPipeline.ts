export interface BuyingScenario {
 id:string;createdAt:string;approvedAt?:string;mode:'budget'|'manual'
 plan:import('./buyingPlan').BuyingPlan
 files:{id:string;name:string}[];draft:string
}
export const novaOperations=['request','browser','calculate','report','draft','review'] as const
export type NovaOperation=typeof novaOperations[number]
export interface NovaWorkflow {id:string;name:string;nodes:{id:string;label:string;config:Record<string,unknown>}[];edges:{sourceNodeId:string;targetNodeId:string}[]}
export interface NovaRun {
 id:string;workflowId:string;workflowName:string;startedAt:string;finishedAt?:string
 state:'running'|'needs_review'|'approved'|'failed'|'cancelled';error?:string
 nodes:{id:string;label:string;operation:NovaOperation;state:'pending'|'running'|'verified'|'needs_review'|'failed';detail?:string;input?:unknown;output?:unknown;outputFileIds?:string[]}[]
 browserRunId?:string;recordingId?:string;scriptRevision?:string
 sources?:{id:string;name:string;sha256:string;bytes:number}[]
 settings?:import('./novaRestocking').RestockSettings
 scenarios?:BuyingScenario[]
 recommendation?:import('./novaRestocking').RestockResult
 delivery?:{state:'sending'|'sent'|'unknown';channel?:string;workspace?:string;ts?:string}
 files:{id:string;name:string}[];draft?:string;approvedAt?:string
}
export interface NovaSchedule {id:string;workflowId:string;label:string;dueAt:string;state:'scheduled'|'running'|'done'|'failed'|'cancelled';runId?:string;error?:string}
export interface NovaAPI {
 saveScenario:(input:{runId:string;budget:number;quantities?:Record<string,number>})=>Promise<BuyingScenario>
 approveScenario:(input:{runId:string;scenarioId:string})=>Promise<void>
 preview:(runId:string,fileId:string)=>Promise<string>

 remove:(id:string)=>Promise<void>
 configure:(workflow:NovaWorkflow)=>Promise<void>
 run:(workflowId:string)=>Promise<NovaRun>
 list:()=>Promise<{runs:NovaRun[];schedules:NovaSchedule[];workflows:{id:string;name:string}[]}>
 scheduleTests:(workflowId:string)=>Promise<NovaSchedule[]>
 cancelSchedule:(id:string)=>Promise<void>
 cancelRun:(id:string)=>Promise<void>
 approve:(runId:string)=>Promise<void>
 reveal:(runId:string,fileId:string)=>Promise<void>
}
