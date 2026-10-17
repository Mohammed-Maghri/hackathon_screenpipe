import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, FileText, Globe, LockKeyhole, Play, Workflow } from '../components/ImageIcon'
import { AppearanceSelector } from '../components/AppearanceSelector'
import { TitleBar } from '../components/TitleBar'
import { GhostLogo } from '../components/GhostLogo'
import { Button } from '../components/Button'
import { WelcomeDialog, type DialogKind } from '../components/WelcomeDialog'

const introduction = [
  { title: 'Describe a routine', description: 'Start with the work you do again and again.' },
  { title: 'Teach the steps', description: 'Show Ghost the browser actions it needs.' },
  { title: 'Review and run', description: 'Check the workflow. You choose when it runs.' },
]
const example = [
  { title: 'Export requests', kind: 'Browser action', icon: Globe },
  { title: 'Filter & merge', kind: 'Data processing', icon: Workflow },
  { title: 'Prepare report', kind: 'File output', icon: FileText },
]

export function Welcome() {
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  return <div className="window-shell relative isolate flex h-full min-h-0 flex-col overflow-hidden bg-canvas text-ink">
    <div className="welcome-titlebar h-14 shrink-0 border-b border-line [&>.titlebar]:h-full">
      <TitleBar onSkip={() => navigate('/dashboard')} />
    </div>
    <main className="welcome-main grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] max-[1280px]:grid-cols-[260px_minmax(0,1fr)] max-[900px]:grid-cols-1">
      <aside className="welcome-guide flex min-h-0 flex-col overflow-y-auto border-r border-sidebar-line bg-sidebar px-8 py-9 text-sidebar-ink max-[1280px]:px-6 max-[900px]:hidden" aria-label="Introducing Ghost">
        <div className="[&_.brand]:text-action-fill [&_.brand-period]:text-action-fill"><GhostLogo /></div>
        <div className="mt-12 max-[1100px]:mt-9">
          <h2 className="text-[28px] leading-tight font-medium tracking-tight">Your work,<br />understood.</h2>
          <p className="mt-3 text-[13px] leading-6 text-sidebar-muted">A little less busywork.<br />A little more possibility.</p>
        </div>
        <ol className="welcome-guide-steps mt-10 grid list-none gap-7 p-0 max-[1100px]:gap-6" aria-label="How Ghost works">
          {introduction.map((step, index) => <li key={step.title} className="relative flex items-start gap-3 [&:not(:last-child)]:before:absolute [&:not(:last-child)]:before:top-8 [&:not(:last-child)]:before:bottom-[-20px] [&:not(:last-child)]:before:left-3 [&:not(:last-child)]:before:border-l [&:not(:last-child)]:before:border-sidebar-line">
            <span className="relative grid size-6 shrink-0 place-items-center rounded-full border border-sidebar-selected-line bg-sidebar font-mono text-[10px] text-sidebar-muted" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div className="min-w-0"><h3 className="pt-0.5 text-[13px] font-semibold tracking-normal">{step.title}</h3><p className="mt-1.5 text-xs leading-5 text-sidebar-muted">{step.description}</p></div>
          </li>)}
        </ol>
        <p className="mt-auto flex items-start gap-2 border-t border-sidebar-line pt-5 text-xs leading-5 text-sidebar-muted"><LockKeyhole className="mt-1" size={13} aria-hidden="true" />Your routines, your control.</p>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="welcome-scroll flex min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <section className="welcome-content m-auto w-full max-w-[760px] px-12 py-10 max-[1280px]:px-8 max-[600px]:px-5 max-[600px]:py-8 [@media(max-height:740px)]:py-6" aria-labelledby="welcome-title">
            <div className="mb-7 hidden max-[900px]:block [&_.brand-period]:text-action-fill [@media(max-height:740px)]:hidden"><GhostLogo /></div>
            <p className="mb-3 font-mono text-xs text-muted">Welcome to Ghost</p>
            <h1 id="welcome-title" className="max-w-[560px] text-[40px] leading-[1.15] font-medium tracking-tight max-[1280px]:text-4xl max-[600px]:text-[30px] [@media(max-height:740px)]:text-[32px]">Turn actions<br className="max-[600px]:hidden" /> into workflows.</h1>
            <p className="subtitle mt-4 max-w-[460px] text-sm leading-6 text-muted [@media(max-height:740px)]:mt-3">Ghost learns from your activity and helps you turn it into automations.</p>

            <figure className="welcome-workflow my-8 overflow-hidden rounded-card border border-line bg-panel max-[600px]:my-6 [@media(max-height:740px)]:my-5" aria-labelledby="welcome-example-title">
              <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <span id="welcome-example-title" className="text-[13px] font-medium">Daily request report</span>
                <span className="font-mono text-[10px] text-muted">Example workflow · 3 steps</span>
              </figcaption>
              <div className="welcome-example-flow grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)_24px_minmax(0,1fr)] items-center bg-canvas px-5 py-7 [background-image:radial-gradient(var(--canvas-dot)_0.75px,transparent_0.75px)] [background-size:16px_16px] max-[600px]:grid-cols-1 max-[600px]:gap-2 max-[600px]:p-4 [@media(max-height:740px)]:py-4">
                {example.map(({ title, kind, icon: Icon }, index) => <div key={title} className="contents">
                  {index > 0 && <ArrowRight className="justify-self-center text-subtle max-[600px]:rotate-90" size={16} aria-hidden="true" />}
                  <div className="welcome-example-node min-w-0 rounded-control border border-strong bg-panel p-3 max-[600px]:flex max-[600px]:items-center max-[600px]:gap-3">
                    <Icon className="mb-4 text-muted max-[600px]:mb-0" size={18} strokeWidth={1.6} aria-hidden="true" />
                    <div className="min-w-0"><p className="text-xs leading-5 font-medium">{title}</p><p className="mt-1 font-mono text-[10px] leading-4 text-muted">{kind}</p></div>
                  </div>
                </div>)}
              </div>
              <p className="border-t border-line px-4 py-2.5 text-[11px] leading-5 text-muted">A workflow you can inspect, teach, and run on your terms.</p>
            </figure>

            <div className="actions flex flex-wrap items-center gap-3 [&_.button]:min-h-11 [&_.button]:px-5 max-[600px]:items-stretch max-[600px]:[&_.button]:w-full">
              <Button onClick={() => navigate('/dashboard')}>Get started <ArrowRight size={17} /></Button>
              <Button variant="secondary" onClick={() => setDialog('explain')}><Play size={14} />See how it works</Button>
            </div>
            <p className="mt-4 font-mono text-[10px] leading-5 text-muted">Connect Screenpipe to discover routines from your activity.</p>
          </section>
        </div>
        <footer className="welcome-footer flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line px-8 py-3 max-[600px]:px-5 [&_.appearance-selector_button]:min-h-8 [&_.appearance-selector_button]:px-2.5 [&_.appearance-selector_button]:py-1.5 [&_.appearance-selector_button]:text-[11px]">
          <AppearanceSelector compact /><span className="version font-mono text-[10px] text-muted">Ghost · v0.1.0</span>
        </footer>
      </div>
    </main>
    <WelcomeDialog kind={dialog} onClose={() => setDialog(null)} onStart={() => navigate('/dashboard')} />
  </div>
}
