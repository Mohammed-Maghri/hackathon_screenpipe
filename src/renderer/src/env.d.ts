/// <reference types="vite/client" />
interface Window {
  ghost?: {
    browser: import('../../shared/browser').TeachingBrowser
    prepareDiscovery: (input: import('../../shared/discovery').DiscoveryRequest) => Promise<import('../../shared/discovery').DiscoveryPreparation>
    listWorkflows: (offset?: number) => Promise<import('../../shared/discovery').WorkflowListResult>
    getWorkflow: (id: string) => Promise<import('../../shared/discovery').WorkflowDetailResult>
    platform: string
    controlWindow: (action: 'minimize' | 'maximize' | 'close') => void
  }
}
