export type WorkflowSchedule = { workflowId: string; nextRun: string | null; intervalMinutes: number; lastRun?: string; result?: string }
export type WorkflowAutomationAPI = {
  list: () => Promise<WorkflowSchedule[]>
  save: (input: WorkflowSchedule) => Promise<void>
  remove: (id: string) => Promise<void>
  run: (id: string) => Promise<void>
}
