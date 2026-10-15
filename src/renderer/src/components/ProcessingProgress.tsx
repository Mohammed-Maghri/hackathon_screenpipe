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
  const labels = stage === 'configuration' ? ['Save changes'] : stage === 'running' ? ['Run saved logic'] : steps
  return <section className="processing-progress" data-stage={stage} aria-label="Processing progress">
    <div className="processing-progress-heading"><span className="processing-progress-orbit" aria-hidden="true"><Sparkles size={20} /></span><div role="status" aria-live="polite"><strong>{message || 'Starting…'}</strong><small>{stage === 'generating' ? 'Building reusable logic from your prompt and input schema.' : stage === 'configuration' ? 'Saving your node settings.' : 'Your files are processed on this computer.'}</small></div><span className="processing-elapsed" aria-hidden="true">{seconds}s</span></div>
    <div className="processing-progress-track" aria-hidden="true"><span /></div>
    <ol className="processing-progress-steps">{labels.map((label, index) => <li key={label} className={index < active ? 'is-done' : index === active ? 'is-active' : ''} aria-current={index === active ? 'step' : undefined}>{index < active ? <Check size={14} aria-hidden="true" /> : index === active ? <LoaderCircle className="processing-spinner" size={14} aria-hidden="true" /> : <span className="processing-step-dot" aria-hidden="true" />}{label}</li>)}</ol>
  </section>
}
