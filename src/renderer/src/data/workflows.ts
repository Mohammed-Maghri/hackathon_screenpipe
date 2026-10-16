export type AppName = 'Microsoft' | 'Google' | 'Slack' | 'Notion' | 'Excel' | 'Gmail' | 'Drive' | 'Chrome' | 'Screenpipe'
export type WorkflowStatus = 'Success' | 'Needs review' | 'Failed' | 'Draft'
export interface Workflow {
  persisted?: boolean
  id: string
  name: string
  description: string
  apps: AppName[]
  seen: number
  lastRun: string
  status: WorkflowStatus
  nextRun: string
  steps: string[]
}
export const sampleWorkflows: Workflow[] = [
  { id: 'orders', name: 'Daily Orders Report', description: 'Collect daily orders, update the report, and prepare a summary.', apps: ['Slack', 'Chrome', 'Excel'], seen: 14, lastRun: '2 hours ago', status: 'Success', nextRun: 'Today at 9:00', steps: ['Open the orders dashboard', 'Collect today’s orders into a spreadsheet', 'Prepare a daily summary for Slack'] },
  { id: 'followups', name: 'Customer Follow-ups', description: 'Review new leads and prepare follow-up messages.', apps: ['Gmail', 'Notion'], seen: 9, lastRun: '1 day ago', status: 'Success', nextRun: 'Tomorrow at 10:00', steps: ['Find new customer inquiries in Gmail', 'Organize contact details in the CRM', 'Draft a personalized follow-up email'] },
  { id: 'docs', name: 'Update Documentation', description: 'Collect recent changes and update internal documentation.', apps: ['Chrome', 'Notion'], seen: 7, lastRun: '3 days ago', status: 'Needs review', nextRun: '—', steps: ['Open the project dashboard', 'Collect the latest project changes', 'Prepare an update for the Notion page'] },
  { id: 'payments', name: 'Check Failed Payments', description: 'Inspect failed payments and prepare a team report.', apps: ['Slack', 'Drive'], seen: 6, lastRun: '5 days ago', status: 'Failed', nextRun: '—', steps: ['Open the payments dashboard', 'Filter unsuccessful payments', 'Prepare a Slack notification for review'] },
  { id: 'monthly', name: 'Generate Monthly Report', description: 'Bring monthly results together in one clear report.', apps: ['Excel', 'Drive'], seen: 4, lastRun: '1 week ago', status: 'Success', nextRun: 'Every Monday', steps: ['Collect monthly spreadsheet totals', 'Assemble the report', 'Save a draft to Drive'] },
]
export const sampleActivity: { time: string; app: AppName; text: string }[] = [
  { time: '10:24', app: 'Chrome', text: 'Opened orders dashboard' },
  { time: '10:18', app: 'Slack', text: 'Viewed #reports in Slack' },
  { time: '09:52', app: 'Excel', text: 'Exported orders.csv' },
  { time: '09:41', app: 'Notion', text: 'Updated Notion page' },
  { time: '09:32', app: 'Gmail', text: 'Opened Gmail' },
  { time: '09:21', app: 'Excel', text: 'Edited Excel report' },
]
