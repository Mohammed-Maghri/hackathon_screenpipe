import { useEffect, useState } from 'react'
import { Check, LoaderCircle, Sparkles } from 'lucide-react'

export type ProcessingStage = 'reading' | 'generating' | 'testing' | 'saving' | 'running' | 'configuration'
const steps = ['Read input', 'Generate logic', 'Run locally', 'Save logic']
export function ProcessingProgress({ stage, message }: { stage: ProcessingStage; message: string }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const active = ({ reading: 0, generating: 1, testing: 2, saving: 3, running: 0, configuration: 0 })[stage]
  const executing = stage !== 'configuration'
  const labels = stage === 'configuration' ? ['Save changes'] : stage === 'running' ? ['Run saved logic'] : steps
  return <section className={`processing-progress my-6 rounded-card border p-5 max-[520px]:p-4 ${executing ? 'border-live/25 bg-live-soft' : 'border-line bg-canvas'}`} data-stage={stage} data-executing={executing} aria-label="Processing progress">
    <div className="processing-progress-heading flex items-center gap-3 [&>div]:min-w-0 [&_strong]:block [&_strong]:text-sm [&_strong]:font-medium [&_strong]:text-ink [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:leading-6 [&_small]:text-muted max-[520px]:flex-wrap [&_small]:font-mono"><span className={`processing-progress-orbit grid size-10 shrink-0 place-items-center rounded-full border bg-panel max-[520px]:hidden ${executing ? 'border-live/25 text-live' : 'border-line text-muted'}`} aria-hidden="true"><Sparkles size={20} /></span><div role="status" aria-live="polite"><strong>{message || 'Starting…'}</strong><small>{stage === 'generating' ? 'Building reusable logic from your prompt and input schema.' : stage === 'configuration' ? 'Saving your node settings.' : 'Your files are processed on this computer.'}</small></div><span className="processing-elapsed font-mono ml-auto text-xs text-muted tabular-nums max-[520px]:ml-0" aria-hidden="true">{seconds}s</span></div>
    <div className={`processing-progress-track relative mt-4.5 mb-3.5 h-1 overflow-hidden rounded [&>span]:absolute [&>span]:block [&>span]:h-full [&>span]:w-[38%] [&>span]:rounded [&>span]:animate-[processing-sweep_1.8s_ease-in-out_infinite] motion-reduce:[&>span]:w-full motion-reduce:[&>span]:animate-none motion-reduce:[&>span]:opacity-50 ${executing ? 'bg-live/15 [&>span]:bg-live' : 'bg-sunken [&>span]:bg-strong'}`} aria-hidden="true"><span /></div>
    <ol className={`processing-progress-steps m-0 flex list-none flex-wrap gap-x-5 gap-y-2.5 p-0 [&>li]:flex [&>li]:items-center [&>li]:gap-1.5 [&>li]:text-xs [&>li]:text-muted [&>li.is-done]:text-success font-mono ${executing ? '[&>li.is-active]:text-live' : '[&>li.is-active]:text-muted'}`}>{labels.map((label, index) => <li key={label} className={index < active ? 'is-done' : index === active ? 'is-active' : ''} aria-current={index === active ? 'step' : undefined}>{index < active ? <Check size={14} aria-hidden="true" /> : index === active ? <LoaderCircle className="processing-spinner animate-spin motion-reduce:animate-none" size={14} aria-hidden="true" /> : <span className="processing-step-dot m-1 size-1.5 rounded-full bg-current" aria-hidden="true" />}{label}</li>)}</ol>
  </section>
}
