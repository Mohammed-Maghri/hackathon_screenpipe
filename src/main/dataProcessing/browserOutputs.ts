import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { RecordingStore } from '../recordingStore'
import { valueSchema, type DataValue } from '../../shared/dataProcessing'
import type { ReplayStatus } from '../../shared/recording'
import { LocalArtifacts } from './executor'
export async function verifiedBrowserOutputs(userData:string,workflowId:string,nodeId:string,artifacts:LocalArtifacts):Promise<Record<string,DataValue>>{
 const recording=await RecordingStore.restore(join(userData,'recordings'),workflowId,nodeId)
 if(!recording)throw new Error('waiting_for_input: Record and successfully replay the upstream browser task first.')
 const replay=JSON.parse(await readFile(join(recording.directory,'last-replay.json'),'utf8')) as ReplayStatus
 if(replay.state!=='completed'||!replay.runId)throw new Error('waiting_for_input: Upstream browser output is not verified.')
 const files=[]
 for(const item of replay.artifacts??[]){const file=await recording.runArtifact(replay.runId,item.id);files.push(await artifacts.register(file.path,join(recording.directory,'downloads'),file.filename))}
 const outputs:Record<string,DataValue>={files:{type:'files',value:files},metadata:{type:'json',value:{runId:replay.runId,completed:replay.completed,finishedAt:replay.finishedAt??null}}}
 for(const [name,value] of Object.entries(replay.structuredOutputs??{}))if(['text','table','json'].includes(name))outputs[name]=valueSchema.parse(value)
 return outputs
}
export async function browserRunStamp(userData:string,workflowId:string,nodeId:string):Promise<string>{
 const recording=await RecordingStore.restore(join(userData,'recordings'),workflowId,nodeId)
 if(!recording)throw new Error('Upstream recording is missing.')
 const replay=JSON.parse(await readFile(join(recording.directory,'last-replay.json'),'utf8')) as ReplayStatus
 if(replay.state!=='completed'||!replay.runId)throw new Error('Upstream output is no longer verified.')
 return recording.id+':'+replay.runId
}
