import { FileSpreadsheet, ScanEye } from 'lucide-react'
import type { AppName } from '../data/workflows'

export function AppMark({ app }: { app: AppName }) {
  let mark
  switch (app) {
    case 'Chrome': mark = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#fbbc05" /><path d="M12 12 6.5 21.5A11 11 0 0 1 2.5 6.5Z" fill="#34a853" /><path d="M2.5 6.5A11 11 0 0 1 22 7H12l-4 7Z" fill="#ea4335" /><circle cx="12" cy="12" r="5" fill="#4285f4" stroke="white" strokeWidth="1.2" /></svg>; break
    case 'Gmail': mark = <svg viewBox="0 0 24 24" fill="none" strokeWidth="3.4" strokeLinejoin="round" aria-hidden="true"><path d="M4 20V6l8 6 8-6v14" stroke="#4285f4" /><path d="M4 6l8 6 8-6" stroke="#ea4335" /><path d="M20 9v11" stroke="#34a853" /><path d="M20 5v5" stroke="#fbbc05" /></svg>; break
    case 'Drive': mark = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 2 6 0 9 16h-6Z" fill="#fbbc04" /><path d="m9 2-9 16 3 5 9-16Z" fill="#34a853" /><path d="m3 23 3-5h18l-3 5Z" fill="#4285f4" /></svg>; break
    case 'Slack': mark = <svg viewBox="0 0 24 24" fill="none" strokeWidth="4" strokeLinecap="round" aria-hidden="true"><path d="M9 3v7M3 9h1" stroke="#36c5f0" /><path d="M21 9h-7M15 3v1" stroke="#2eb67d" /><path d="M15 21v-7M21 15h-1" stroke="#ecb22e" /><path d="M3 15h7M9 21v-1" stroke="#e01e5a" /></svg>; break
    case 'Excel': mark = <FileSpreadsheet size={18} aria-hidden="true" />; break
    case 'Screenpipe': mark = <ScanEye size={18} aria-hidden="true" />; break
    default: mark = <b aria-hidden="true">N</b>
  }
  return <span className={`app-mark app-mark--${app.toLowerCase()}`} title={app} aria-label={app}>{mark}</span>
}
