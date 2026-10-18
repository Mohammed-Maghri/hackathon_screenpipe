import {upgradeNova} from './upgradeNova'
import type { WorkflowCreate, WorkflowUpdate, SavedWorkflowDetail, WorkflowDetailResult, WorkflowListResult, WorkflowListOptions, DiscoveryPreparation } from '../../../shared/discovery'

export const preparedDiscovery = import.meta.env.VITE_GHOST_DISCOVERY_MODE !== 'live'
const key = 'ghost.prepared-workflows.v1'
function read(): SavedWorkflowDetail[] {
  const value = JSON.parse(localStorage.getItem(key) ?? '[]')
  if (!Array.isArray(value) || !value.every(w => typeof w.id === 'string' && Array.isArray(w.nodes) && Array.isArray(w.edges))) throw new Error('Invalid local workflows')
  let changed = false
  for (const workflow of value) for (const node of workflow.nodes) {
    if (node.config?.source === 'demo' && node.config.demoScenario === 'nova' && node.config.startUrl === 'http://127.0.0.1:3104/nova/restocking') {
      node.config.startUrl = 'https://hackathon-screenpipe.vercel.app/nova/restocking'
      changed = true
    }
  }
  if (changed) write(value)
  return value
}
function write(values: SavedWorkflowDetail[]) { localStorage.setItem(key, JSON.stringify(values)) }
const storageError = { ok: false as const, error: 'Unable to read or save local workflows. Check available storage; existing data has not been replaced.' }
const unavailable = { ok: false as const, error: 'Open Ghost desktop to connect to the backend.' }
export const workflowClient = {
  async createWorkflow(input: WorkflowCreate): Promise<WorkflowDetailResult> {
    if (!preparedDiscovery) return window.ghost?.createWorkflow(input) ?? unavailable
    try {
      read() // Validate storage before creating local browser assets.
      const workflow: SavedWorkflowDetail = { ...input, id: crypto.randomUUID(), status: input.status ?? 'DRAFT', updatedAt: new Date().toISOString(), nodes: input.nodes ?? [], edges: input.edges ?? [] }
      const browserNodes = workflow.nodes.filter(node => node.config.stepType === 'browser' && typeof node.config.startUrl === 'string').map(node => ({id:node.id, url:node.config.startUrl as string}))
      if (browserNodes.length && window.ghost?.browser) {
        try { await window.ghost.browser.prepareHosted(workflow.id, browserNodes) }
        catch { return {ok:false, error:'Unable to save the browser task and login. Workflow generation did not complete. Please retry.'} }
      }
      if(workflow.nodes.some(n=>n.config.novaOperation)) await window.ghost?.nova?.configure(workflow)
      // Re-read after IPC so concurrent creations do not overwrite one another.
      write([workflow, ...read()]); return { ok: true, workflow }
    } catch { return storageError }
  },
  async listWorkflows(offset = 0, options: WorkflowListOptions = {}): Promise<WorkflowListResult> {
    if (!preparedDiscovery) return window.ghost?.listWorkflows(offset, options) ?? unavailable
    try {
      const rows = read().filter(w => (!options.status || w.status === options.status) && (!options.search || `${w.name} ${w.description ?? ''}`.toLowerCase().includes(options.search.toLowerCase()))).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))
      return { ok: true, total: rows.length, items: rows.slice(offset, offset + (options.limit ?? 4)).map(w => ({ ...w, _count: { nodes: w.nodes.length, edges: w.edges.length }, applications: [...new Set(w.nodes.map(n => n.config.application).filter((a): a is string => typeof a === 'string'))], applicationIcons: [...new Set(w.nodes.map(n => n.config.stepType === 'browser' ? 'Chrome' : n.config.application).filter((a): a is string => typeof a === 'string'))] })) }
    } catch { return storageError }
  },
  async getWorkflow(id: string): Promise<WorkflowDetailResult> {
    if (!preparedDiscovery) return window.ghost?.getWorkflow(id) ?? unavailable
    try {
      let workflow = read().find(w => w.id === id)
      if(workflow && window.ghost?.nova){
        const upgraded=upgradeNova(workflow)
        if(upgraded){
          // Preserve the entire original graph before upgrading; browser node ID/config are retained.
          const backupKey='ghost.nova-upgrade-backup.'+id
          if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,JSON.stringify(workflow))
          await window.ghost.nova.configure(upgraded)
          write(read().map(w=>w.id===id?upgraded:w));workflow=upgraded
        } else if(workflow.nodes.some(n=>n.config.novaOperation)) {
          const registered=await window.ghost.nova.list()
          if(!registered.workflows.some(w=>w.id===id))await window.ghost.nova.configure(workflow)
        }
      }
      return workflow ? {ok:true,workflow} : {ok:false,error:'This workflow is not saved on this device.'}
    } catch(error) { return {ok:false,error:error instanceof Error?error.message:storageError.error} }
  },
  async updateWorkflow(id: string, input: WorkflowUpdate): Promise<WorkflowDetailResult> {
    if (!preparedDiscovery) return window.ghost?.updateWorkflow(id, input) ?? unavailable
    try {
      const rows = read(); const index = rows.findIndex(w => w.id === id)
      if (index < 0) return { ok: false, error: 'This workflow is not saved on this device.' }
      const workflow = { ...rows[index], ...input, updatedAt: new Date().toISOString() }
      if(workflow.nodes.some(n=>n.config.novaOperation)) await window.ghost?.nova?.configure(workflow)
      rows[index] = workflow; write(rows); return { ok: true, workflow }
    } catch { return storageError }
  },
  async deleteWorkflow(id: string): Promise<DiscoveryPreparation> {
    if (!preparedDiscovery) return window.ghost?.deleteWorkflow(id) ?? unavailable
    try { await window.ghost?.nova?.remove(id); write(read().filter(w => w.id !== id)); return { ok: true } } catch { return storageError }
  },
}
