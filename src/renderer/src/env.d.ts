/// <reference types="vite/client" />
interface Window {
  ghost?: {
    runtimeLogic: import('../../shared/processingPlan').RuntimeLogicAPI
    automation: import('../../shared/workflowSchedule').WorkflowAutomationAPI
    processing: import('../../shared/dataProcessing').ProcessingAPI
    browser: import('../../shared/browser').TeachingBrowser
    prepareDiscovery: (input: import('../../shared/discovery').DiscoveryRequest) => Promise<import('../../shared/discovery').DiscoveryPreparation>
    createWorkflow: (input: import('../../shared/discovery').WorkflowCreate) => Promise<import('../../shared/discovery').WorkflowDetailResult>
    listWorkflows: (offset?: number, options?: import('../../shared/discovery').WorkflowListOptions) => Promise<import('../../shared/discovery').WorkflowListResult>
    deleteWorkflow: (id: string) => Promise<import('../../shared/discovery').DiscoveryPreparation>
    getWorkflow: (id: string) => Promise<import('../../shared/discovery').WorkflowDetailResult>
    discoverWorkflow: (input: import('../../shared/discovery').GenerateWorkflowRequest) => Promise<import('../../shared/discovery').WorkflowDetailResult>
    onDiscoveryProgress: (listener: (progress: import('../../shared/discovery').DiscoveryProgress) => void) => () => void
    mockDiscovery: (input: import('../../shared/discovery').DiscoveryRequest) => Promise<import('../../shared/discovery').DiscoveryPreparation>
    generateWorkflow: (input: import('../../shared/discovery').GenerateWorkflowRequest) => Promise<import('../../shared/discovery').WorkflowDetailResult>
    defineWorkflowContracts: (id: string) => Promise<import('../../shared/discovery').WorkflowDetailResult>
    updateWorkflow: (id: string, input: import('../../shared/discovery').WorkflowUpdate) => Promise<import('../../shared/discovery').WorkflowDetailResult>
    setAppearance?: (theme: 'light' | 'dark') => Promise<void>
    platform: string
    controlWindow: (action: 'minimize' | 'maximize' | 'close') => void
  }
}
