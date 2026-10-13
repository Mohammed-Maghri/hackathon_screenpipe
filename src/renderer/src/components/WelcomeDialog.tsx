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
  return <dialog ref={ref} className="welcome-dialog" aria-labelledby="dialog-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="dialog-inner">
      <button className="dialog-close" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>
      <GhostLogo compact />
      <p className="eyebrow">{kind === 'start' ? 'A LITTLE LESS BUSYWORK' : 'FROM ROUTINE TO POSSIBILITY'}</p>
      <h2 id="dialog-title">{kind === 'start' ? <>Make room for<br /><em>what matters.</em></> : <>Your everyday work.<br /><em>A new kind of flow.</em></>}</h2>
      {kind === 'start' ? <><p className="dialog-copy">You’re at the beginning of Ghost. This welcome preview is ready to explore; activity connection and automation setup are coming next.</p><div className="preview-note"><span />Welcome preview <span className="ml-auto">v0.1.0</span></div><Button variant="secondary" onClick={onClose}><ArrowLeft size={17} /> Back to welcome</Button></> : <><ol className="steps"><li><span>01</span><div><h3>Observe your natural rhythm</h3><p>Screenpipe provides the context of your daily activity.</p></div></li><li><span>02</span><div><h3>Understand the repetition</h3><p>Ghost is designed to help you spot work you do again and again.</p></div></li><li><span>03</span><div><h3>Give your time back</h3><p>Turn those routines into automations you choose and control.</p></div></li></ol><p className="dialog-footnote">A look at what’s ahead. No activity is being recorded.</p><Button onClick={onStart}>Get started <ArrowRight size={18} /></Button></>}
    </div>
  </dialog>
}
