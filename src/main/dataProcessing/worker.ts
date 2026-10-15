import { parentPort, workerData } from 'node:worker_threads'
import { LocalArtifacts } from './executor'
import { OutputInspector } from './outputInspector'
import { executePlan } from './planExecutor'
async function run(){
 const artifacts=new LocalArtifacts(workerData.directory);artifacts.restore(workerData.manifest)
 const inspected=await new OutputInspector(artifacts).inspect(workerData.inputs)
 if(workerData.fingerprint && inspected.fingerprint!==workerData.fingerprint)throw new Error('Input schema changed. Review and regenerate logic before execution.')
 if(!workerData.plan)return {schema:inspected.schema,fingerprint:inspected.fingerprint}
 const outputs=await executePlan(workerData.plan,inspected.schema,workerData.expectedOutput,inspected.datasets,artifacts)
 return {schema:inspected.schema,fingerprint:inspected.fingerprint,outputs,manifest:artifacts.snapshot()}
}
void run().then(value=>parentPort!.postMessage({ok:true,value}),error=>parentPort!.postMessage({ok:false,error:error instanceof Error?error.message:'Processing failed.'}))
