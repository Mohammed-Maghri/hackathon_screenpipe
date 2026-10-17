import { useEffect, useRef } from 'react'
import { ArrowLeft, ArrowRight, X } from './ImageIcon'
import { Button } from './Button'
import { GhostLogo } from './GhostLogo'
export type DialogKind = 'start' | 'explain'
export function WelcomeDialog({ kind, onClose, onStart }: { kind: DialogKind | null; onClose: () => void; onStart: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (kind && dialog && !dialog.open) dialog.showModal()
    if (!kind && dialog?.open) dialog.close()
  }, [kind])
  return <dialog ref={ref} className="welcome-dialog dialog-surface" aria-labelledby="dialog-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="dialog-inner relative p-8 max-[600px]:px-6 max-[600px]:py-7 [&>.brand]:mb-6 [&>.button]:mt-6 [&>.button]:w-full">
      <button className="dialog-close" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>
      <GhostLogo compact />
      <p className="eyebrow mr-10 mb-4">{kind === 'start' ? 'A little less busywork' : 'How Ghost works'}</p>
      <h2 className="mb-6 text-2xl leading-tight font-semibold tracking-tight [&_em]:text-action [&_em]:not-italic max-[600px]:text-2xl" id="dialog-title">{kind === 'start' ? <>Make room for<br /><em>what matters.</em></> : <>From routine<br /><em>to workflow.</em></>}</h2>
      {kind === 'start' ? <><p className="dialog-copy mb-5 text-sm leading-relaxed text-muted">You’re at the beginning of Ghost. Describe a routine, review its steps, and teach Ghost the browser actions it needs.</p><div className="preview-note flex items-center gap-2 border-y border-line py-4 text-xs text-muted [&>span:first-child]:block [&>span:first-child]:size-1.5 [&>span:first-child]:rounded-full [&>span:first-child]:bg-action"><span />Your local workspace <span className="ml-auto">v0.1.0</span></div><Button variant="secondary" onClick={onClose}><ArrowLeft size={17} /> Back to welcome</Button></> : <><ol className="steps my-6 grid list-none gap-6 p-0 [&_li]:flex [&_li]:items-start [&_li]:gap-4 [&_li>span]:pt-0.5 [&_li>span]:text-xs [&_li>span]:text-muted [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_p]:text-xs [&_p]:leading-relaxed [&_p]:text-muted"><li><span>01</span><div><h3>Describe a routine</h3><p>Start with a description or choose activity recorded by Screenpipe.</p></div></li><li><span>02</span><div><h3>Review and teach the steps</h3><p>Check the workflow, configure its inputs, and record any browser actions.</p></div></li><li><span>03</span><div><h3>Test, then run</h3><p>Review the test result before running or scheduling the workflow.</p></div></li></ol><p className="dialog-footnote mt-4 text-xs leading-relaxed text-muted">You choose what to teach, test, and run.</p><Button onClick={onStart}>Get started <ArrowRight size={18} /></Button></>}
    </div>
  </dialog>
}
