import slack from '../assets/app-imagery/slack.svg'
import microsoft from '../assets/app-imagery/microsoft.svg'
import google from '../assets/app-imagery/google.svg'
import excel from '../assets/app-imagery/excel.svg'
import outlook from '../assets/app-imagery/outlook.svg'
import gmail from '../assets/app-imagery/gmail.svg'
import drive from '../assets/app-imagery/drive.svg'
import chrome from '../assets/app-imagery/chrome.svg'
import notion from '../assets/app-imagery/notion.svg'
import screenpipe from '../assets/app-imagery/screenpipe.svg'
import { Workflow } from './ImageIcon'
import { Mail } from 'lucide-react'

const appImages: Record<string, string> = { Slack: slack, Microsoft: microsoft, Google: google, Excel: excel, Outlook: outlook, Gmail: gmail, Drive: drive, Chrome: chrome, Notion: notion, Screenpipe: screenpipe }
const aliases: Record<string, string> = { 'google chrome': 'Chrome', browser: 'Chrome', 'google drive': 'Drive', 'microsoft excel': 'Excel', 'microsoft outlook': 'Outlook', 'google mail': 'Gmail', 'google gmail': 'Gmail', 'screen pipe': 'Screenpipe' }
export function AppMark({ app }: { app: string }) {
  const normalized = app.trim().replace(/\s+/g, ' ').toLowerCase()
  const key = aliases[normalized] ?? Object.keys(appImages).find(name => name.toLowerCase() === normalized) ?? app
  const Fallback = /email|e-mail|mail/i.test(app) ? Mail : Workflow
  return <span className="app-mark app-mark--image inline-grid size-7.5 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-panel p-0.5 text-ink" title={app} role="img" aria-label={app}>{appImages[key] ? <img className="block size-full object-contain" src={appImages[key]} width="26" height="26" alt="" draggable={false} /> : <Fallback size={18} strokeWidth={1.6} aria-hidden="true" />}</span>
}
