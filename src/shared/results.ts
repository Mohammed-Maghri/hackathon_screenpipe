export interface RunSummary {
 id:string; recordingId:string; workflowId:string; nodeId:string; startedAt:string; finishedAt:string|null
 state:string; verified:number; total:number; failureCode:string|null
 actions:{sequence:number;type:string;state:string}[]
 files:{id:string;name:string;bytes:number;state:string}[]
}
export interface StockChange {id:string;name:string;previous:number|null;current:number|null;delta:number|null}
export interface RunComparison {baseline:RunSummary|null;rows:StockChange[];message:string}
export interface ResultsAPI {
 list:()=>Promise<{runs:RunSummary[];warnings:number}>
 compare:(recordingId:string,runId:string)=>Promise<RunComparison>
 reveal:(recordingId:string,runId:string,artifactId:string)=>Promise<void>
}
