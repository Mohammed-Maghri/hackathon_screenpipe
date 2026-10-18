import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {browserExportScript} from './browserExportScript'
import { novaOperations } from '../shared/novaPipeline'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, rename, rm, realpath, readdir } from 'node:fs/promises'
import { join, relative, isAbsolute } from 'node:path'
import { z } from 'zod'
import { operations, processingSchema, outputPorts, validateProcessing } from '../shared/dataProcessing'
import type { ScriptPackage, ScriptNode } from '../shared/workflowScripts'

const id = z.string().uuid()
const graphSchema = z.object({
  id, name: z.string().max(500),
  nodes: z.array(z.object({id:z.string().min(1).max(128),label:z.string().max(500),config:z.record(z.string(),z.unknown())})).max(500),
  edges:z.array(z.object({sourceNodeId:z.string(),targetNodeId:z.string()})).max(2000),
})
function digest(value: string) { return createHash('sha256').update(value).digest('hex') }
function safeURL(raw: unknown) {
  if (typeof raw !== 'string' || !raw) return null
  const url = new URL(raw)
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw Error('Browser URL must be HTTP(S) without credentials.')
  if ([...url.searchParams.keys()].some(k => /token|secret|password|code|key/i.test(k)) || url.hash) throw Error('Remove authentication parameters or fragments from the starting URL before generating scripts.')
  return url.href
}
export class WorkflowScriptStore {
  constructor(private root: string) {}
  async generate(raw: unknown): Promise<ScriptPackage> {
    if (JSON.stringify(raw).length > 2_000_000) throw Error('Workflow is too large to export.')
    const graph = graphSchema.parse(raw)
    const ids = new Set(graph.nodes.map(n => n.id))
    if (ids.size !== graph.nodes.length) throw Error('Duplicate node IDs.')
    if (graph.edges.some(e => !ids.has(e.sourceNodeId) || !ids.has(e.targetNodeId))) throw Error('An edge references a missing node.')
    const ordered: typeof graph.nodes = [], remaining = [...graph.nodes]
    while (remaining.length) {
      const index = remaining.findIndex(n => graph.edges.filter(e => e.targetNodeId === n.id).every(e => ordered.some(p => p.id === e.sourceNodeId)))
      if (index < 0) throw Error('Remove the workflow cycle before generating scripts.')
      ordered.push(...remaining.splice(index,1))
    }
    const configs = graph.nodes.map(n => ({id:n.id,config:{stepType:String(n.config.stepType ?? ''),dataProcessing:n.config.stepType === 'data_processing' ? processingSchema.parse(n.config.dataProcessing) : undefined}}))
    const typed = {nodes:configs,edges:graph.edges}
    const files = new Map<string,string>(), manifestNodes: ScriptNode[] = []
    for (const [index,node] of ordered.entries()) {
      const kind = String(node.config.stepType ?? 'unknown')
      let config: Record<string,unknown> = {}, status: ScriptNode['status'] = 'blocked', reason = 'This node has no implemented execution adapter.'
      let inputs: unknown = {}, outputs: unknown = []
      if (novaOperations.includes(node.config.novaOperation as any)) {
        config = {novaOperation:node.config.novaOperation}; status='runtime_required'; reason='Executable by the local NOVA pipeline runtime.'
        inputs={previous:'current run only'}
        outputs=({request:['validated request'],browser:['verified sales CSV','verified inventory CSV','reference Excel'],calculate:['restocking recommendation','source snapshots with SHA-256','planning assumptions'],report:['Excel buying list','CSV buying list','JSON calculation'],draft:['local message draft'],review:['explicit approval','separate budget/manual proposals']} as Record<string,string[]>)[String(node.config.novaOperation)]
      } else if (kind === 'browser') {
        config = {startUrl:safeURL(node.config.startUrl)}
        status = config.startUrl ? 'runtime_required' : 'blocked'
        reason = config.startUrl ? 'Requires Ghost browser replay, a taught recording, and run authorization.' : 'Set a starting URL and teach this browser task.'
        outputs = outputPorts({id:node.id,config:{stepType:'browser'}})
      } else if (kind === 'data_processing') {
        const processing = processingSchema.parse(node.config.dataProcessing)
        if (processing.mode === 'generated') {
          reason = 'Generated plans must execute through Ghost’s approval and input-fingerprint checks; standalone export is blocked.'
        } else {
          const errors = validateProcessing(typed,node.id)
          reason = errors.length ? errors.join(' ') : 'Requires Ghost’s validated processing runtime and bound inputs.'
          status = errors.length ? 'blocked' : 'runtime_required'
          config = processing as unknown as Record<string,unknown>
          inputs = processing.inputs; outputs = operations[processing.operation].outputs
        }
      } else if (kind === 'integration') reason = 'Delivery is not configured. No Slack or Screenpipe request is generated or sent.'
      else if (kind === 'review') reason = 'A human approval adapter must be connected before this step can execute.'
      // Do not export recording values, encrypted bundles, connection credentials or free-form instructions.
      const serialized = JSON.stringify(config)
      if (/"(?:password|passcode|token|secret|cookie|authorization|apiKey|encryptedValue)"\s*:/i.test(serialized)) throw Error('Remove credentials from node configuration; scripts reference runtime secrets instead.')
      const file = `node-${String(index+1).padStart(3,'0')}.mjs`
      const descriptor = {workflowId:graph.id,nodeId:node.id,kind,config}
      const body = config.novaOperation ? `if (!runtime?.nova?.execute) throw new Error('Ghost NOVA runtime is required.');\n  return runtime.nova.execute(descriptor, inputs);` : status === 'blocked' ? `throw new Error(${JSON.stringify(reason)});` : kind === 'browser'
        ? `if (!runtime?.browser?.replay) throw new Error('Ghost browser runtime is required.');\n  return runtime.browser.replay(descriptor, inputs);`
        : `if (!runtime?.processing?.execute) throw new Error('Ghost processing runtime is required.');\n  return runtime.processing.execute(descriptor, inputs);`
      files.set(file,`// Generated by Ghost. Review before use. This module requires the documented runtime adapter.\nexport const descriptor = ${JSON.stringify(descriptor,null,2)};\nexport async function run(runtime, inputs = {}) {\n  ${body}\n}\n`)
      if(config.novaOperation==='calculate'){
        const resolve=createRequire(import.meta.url).resolve
        files.set(file,browserExportScript(pathToFileURL(resolve('csv-parse/sync')).href,pathToFileURL(resolve('exceljs')).href))
      }
      manifestNodes.push({nodeId:node.id,label:node.label,file,kind,dependencies:graph.edges.filter(e=>e.targetNodeId===node.id).map(e=>e.sourceNodeId),inputs,outputs,status,reason})
    }
    files.set('README.md',`# ${graph.name}\n\nGenerated local node modules, not a standalone automation runner.\n\nEach node exports descriptor and async run(runtime, inputs). Processing calls runtime.processing.execute(descriptor, inputs); browser calls runtime.browser.replay(descriptor, inputs). Adapters must enforce current-run input bindings, validation, authorization and post-action verification. The NOVA complete-workflow runner executes its generated modules through runtime.nova.execute after checking their generated content hashes. Other exported modules require the documented adapters.\n\nBrowser recordings and login secrets stay in Ghost's protected recording store. Raw values, prompts and instructions are not exported. No downloads or account credentials are copied.\n\nBlocked nodes throw an explicit error. There is no fake Slack send, no AI code execution, and no automatic retry. Generated processing plans remain subject to the existing approval system and are not exported as executable plans.\n\nRegenerate after editing the board. Previous revisions are retained. Filenames are indexed; manifest.json maps them to node IDs, dependencies and ports.\n`)
    const revision = randomUUID(), directory = join(this.root,id.parse(graph.id),revision)
    const fingerprint = digest(JSON.stringify({nodes:manifestNodes,scripts:[...files]}))
    const result: ScriptPackage = {version:1,workflowId:graph.id,revision,fingerprint,createdAt:new Date().toISOString(),fileHashes:Object.fromEntries([...files].map(([name,source])=>[name,digest(source)])),directory,nodes:manifestNodes,files:[...files.keys(),'manifest.json']}
    files.set('manifest.json',JSON.stringify(result,null,2))
    const staging=directory+'.pending'
    await mkdir(staging,{recursive:true,mode:0o700})
    try { for (const [name,contents] of files) await writeFile(join(staging,name),contents,{mode:0o600,flag:'wx'}); await rename(staging,directory) }
    catch(error) { await rm(staging,{recursive:true,force:true}); throw error }
    return result
  }
  async latest(workflowId: string): Promise<ScriptPackage | null> {
    const directory=join(this.root,id.parse(workflowId))
    let entries: string[]
    try { entries=await readdir(directory) } catch(error) { if ((error as NodeJS.ErrnoException).code==='ENOENT') return null; throw error }
    const packages: ScriptPackage[]=[]
    for (const revision of entries.filter(name=>id.safeParse(name).success)) {
      const pack=JSON.parse(await this.read(workflowId,revision,'manifest.json')) as ScriptPackage
      if(pack.workflowId!==workflowId || pack.revision!==revision || pack.version!==1) throw Error('Invalid local script manifest.')
      packages.push({...pack,directory:await this.path(workflowId,revision)})
    }
    return packages.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]??null
  }
  async path(workflowId: string, revision: string) {
    const base = await realpath(this.root), directory = await realpath(join(this.root,id.parse(workflowId),id.parse(revision)))
    const rel=relative(base,directory)
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('Invalid script directory.')
    return directory
  }
  async read(workflowId: string, revision: string, file: string) {
    if (!/^(node-\d{3}\.mjs|manifest\.json|README\.md)$/.test(file)) throw Error('Invalid script file.')
    const directory=await this.path(workflowId,revision), path=await realpath(join(directory,file))
    if (relative(directory,path)!==file) throw Error('Script file escaped its package.')
    const text=await readFile(path,'utf8')
    if (text.length>2_000_000) throw Error('Script preview is too large.')
    return text
  }
}
