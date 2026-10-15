import { Worker } from 'node:worker_threads'
import type { DataValue } from '../../shared/dataProcessing'
import type { InputSchema, ProcessingPlan, ExpectedOutput } from '../../../backend/src/contracts/processingPlan'
import { LocalArtifacts } from './executor'
import { LIMITS } from './outputInspector'
export type WorkerResult={schema:InputSchema;fingerprint:string;outputs?:Record<string,DataValue>;manifest?:ReturnType<LocalArtifacts['snapshot']>}
export function runProcessingWorker(artifacts:LocalArtifacts,inputs:Record<string,DataValue>,options:{plan?:ProcessingPlan;expectedOutput?:ExpectedOutput;fingerprint?:string}={}):Promise<WorkerResult>{
 return new Promise((resolve,reject)=>{
  // Trusted, registered TypeScript operations only. This worker is a resource boundary, NOT a code sandbox.
  const worker=new Worker(new URL('./processing-worker.js',import.meta.url),{workerData:{directory:artifacts.directory,manifest:artifacts.snapshot(),inputs,...options},resourceLimits:{maxOldGenerationSizeMb:LIMITS.memoryMb,maxYoungGenerationSizeMb:32}})
  const timer=setTimeout(()=>{void worker.terminate();reject(new Error('Resource limit: processing exceeded 30 seconds.'))},LIMITS.milliseconds)
  worker.once('message',message=>{clearTimeout(timer);void worker.terminate();if(message.ok)resolve(message.value);else reject(new Error(message.error))})
  worker.once('error',()=>{clearTimeout(timer);reject(new Error('Processing worker failed or exceeded its memory limit.'))})
  worker.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(new Error('Processing worker exited before completion.'))})
 })
}
