import { useLayoutEffect, useId, useRef, type ReactNode } from 'react'
import { X } from './ImageIcon'
export function DashboardDialog({ title, children, onClose, className = '' }: { className?: string; title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useLayoutEffect(() => {
    const dialog = ref.current
    const id = crypto.randomUUID()
    const browser = window.ghost?.browser
    let disposed = false
    const show = () => { if (!disposed && dialog?.isConnected && !dialog.open) dialog.showModal() }
    // Chromium's top layer cannot cover Electron native child views. Wait until
    // the main process detaches the browser before displaying the dialog.
    if (browser) void browser.modal(id, true).then(show).catch(() => { /* Keep content hidden if the browser cannot be hidden safely. */ })
    else show()
    return () => { disposed = true; dialog?.close(); if (browser) void browser.modal(id, false).catch(() => {}) }
  }, [])
  return <dialog ref={ref} className={`dashboard-dialog ${className}`} aria-labelledby={titleId} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dashboard-dialog-inner"><button className="dialog-close" onClick={onClose} aria-label="Close dialog"><X size={19} /></button><p className="eyebrow">GHOST / WORKSPACE PREVIEW</p><h2 id={titleId}>{title}</h2>{children}</div>
  </dialog>
}
