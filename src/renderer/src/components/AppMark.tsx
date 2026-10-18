import projectFolder from '../assets/app-imagery/project-folder.svg'
import openai from '../assets/app-imagery/openai.svg'
import discord from '../assets/app-imagery/discord.svg'
import {appIdentity} from '../data/appIdentity'
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

const appImages: Record<string, string> = { EmDash: projectFolder, Slack: slack, Microsoft: microsoft, Google: google, Excel: excel, Outlook: outlook, Gmail: gmail, Drive: drive, Chrome: chrome, Notion: notion, Screenpipe: screenpipe, ChatGPT: openai, Codex: openai, Discord: discord }
export function AppMark({ app }: { app: string }) {
  const key = appIdentity(app)
  const Fallback = /email|e-mail|mail/i.test(app) ? Mail : Workflow
  return <span className="app-mark app-mark--image inline-grid size-7.5 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-panel p-0.5 text-ink" style={key==='ChatGPT'||key==='Codex'?{backgroundColor:'#fff'}:undefined} data-app={key} title={app} role="img" aria-label={app}>{appImages[key] ? <img className="block size-full object-contain" src={appImages[key]} width="26" height="26" alt="" draggable={false} /> : <Fallback size={18} strokeWidth={1.6} aria-hidden="true" />}</span>
}
