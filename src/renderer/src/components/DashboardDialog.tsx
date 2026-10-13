import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from './ImageIcon'
export function DashboardDialog({ title, children, onClose, className = '' }: { className?: string; title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return <dialog ref={ref} className={`dashboard-dialog ${className}`} aria-labelledby={titleId} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dashboard-dialog-inner"><button className="dialog-close" onClick={onClose} aria-label="Close dialog"><X size={19} /></button><p className="eyebrow">GHOST / WORKSPACE PREVIEW</p><h2 id={titleId}>{title}</h2>{children}</div>
  </dialog>
}
