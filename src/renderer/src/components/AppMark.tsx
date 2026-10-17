import slack from '../assets/app-imagery/slack.png'
import microsoft from '../assets/app-imagery/microsoft.png'
import google from '../assets/app-imagery/google.png'
import excel from '../assets/app-imagery/excel.png'
import gmail from '../assets/app-imagery/gmail.png'
import drive from '../assets/app-imagery/drive.png'
import chrome from '../assets/app-imagery/chrome.png'
import notion from '../assets/app-imagery/notion.png'
import screenpipe from '../assets/app-imagery/screenpipe.png'
import { Workflow } from './ImageIcon'

const appImages: Record<string, string> = { Slack: slack, Microsoft: microsoft, Google: google, Excel: excel, Gmail: gmail, Drive: drive, Chrome: chrome, Notion: notion, Screenpipe: screenpipe }
export function AppMark({ app }: { app: string }) {
  return <span className="app-mark app-mark--image inline-grid size-7.5 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-panel p-0.5 text-ink" title={app} role="img" aria-label={app}>{appImages[app] ? <img className="block size-full object-contain" src={appImages[app]} width="26" height="26" alt="" draggable={false} /> : <Workflow size={18} strokeWidth={1.6} aria-hidden="true" />}</span>
}
