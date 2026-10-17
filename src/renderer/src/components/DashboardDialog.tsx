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
    let occluded = false
    const sync = () => {
      if (disposed || !dialog?.isConnected) return
      // Modal dialogs escape ancestor inertness through the top layer. Defer
      // background results, or suspend an open dialog, until its page returns.
      if (dialog.closest('[inert]')) { if (dialog.open) dialog.close(); return }
      if (occluded && !dialog.open) dialog.showModal()
    }
    const inert = new MutationObserver(sync)
    for (let ancestor: HTMLElement | null = dialog; ancestor; ancestor = ancestor.parentElement) inert.observe(ancestor, { attributes: true, attributeFilter: ['inert'] })
    const show = () => { occluded = true; sync() }
    // Chromium's top layer cannot cover Electron native child views. Wait until
    // the main process detaches the browser before displaying the dialog.
    if (browser) void browser.modal(id, true).then(show).catch(() => { /* Keep content hidden if the browser cannot be hidden safely. */ })
    else show()
    return () => { disposed = true; inert.disconnect(); dialog?.close(); if (browser) void browser.modal(id, false).catch(() => {}) }
  }, [])
  return <dialog ref={ref} className={`dashboard-dialog dialog-surface ${className}`} aria-labelledby={titleId} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dashboard-dialog-inner relative p-8 max-[600px]:px-6 max-[600px]:py-7"><button className="dialog-close" onClick={onClose} aria-label="Close dialog"><X size={19} /></button><p className="eyebrow mr-10 mb-4">Ghost / Workspace</p><h2 className="mb-6 text-2xl leading-tight font-semibold tracking-tight max-[600px]:text-2xl" id={titleId}>{title}</h2>{children}</div>
  </dialog>
}
