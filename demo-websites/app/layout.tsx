import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'Forma — Workspace', description: 'Local finance and customer operations demo for Ghost recording.' }
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en" data-theme="dark" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html: "try{document.documentElement.dataset.theme=localStorage.getItem('forma-theme')==='light'?'light':'dark'}catch{}"}} /></head><body>{children}</body></html> }
