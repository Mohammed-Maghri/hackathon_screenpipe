import slack from '../assets/app-imagery/slack.png'
import microsoft from '../assets/app-imagery/microsoft.png'
import google from '../assets/app-imagery/google.png'
import excel from '../assets/app-imagery/excel.png'
import gmail from '../assets/app-imagery/gmail.png'
import drive from '../assets/app-imagery/drive.png'
import chrome from '../assets/app-imagery/chrome.png'
import notion from '../assets/app-imagery/notion.png'
import screenpipe from '../assets/app-imagery/screenpipe.png'
import generic from '../assets/workflow-imagery/workflows.png'

const appImages: Record<string, string> = { Slack: slack, Microsoft: microsoft, Google: google, Excel: excel, Gmail: gmail, Drive: drive, Chrome: chrome, Notion: notion, Screenpipe: screenpipe }
export function AppMark({ app }: { app: string }) {
  return <span className="app-mark app-mark--image" title={app} role="img" aria-label={app}><img src={appImages[app] ?? generic} alt="" draggable={false} /></span>
}
