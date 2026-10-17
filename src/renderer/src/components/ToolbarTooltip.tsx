import { cloneElement, useId, useState, type ButtonHTMLAttributes, type ReactElement } from 'react'

export function ToolbarTooltip({ label, children, suppressed = false }: {
  label: string;
  children: ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
  suppressed?: boolean;
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const shown = visible && !suppressed
  return <span className="canvas-tool relative block" onPointerEnter={event => {
    if (event.pointerType !== 'touch') setVisible(true)
  }} onPointerLeave={event => {
    if (!event.currentTarget.querySelector('button')?.matches(':focus-visible')) setVisible(false)
  }} onFocusCapture={event => {
    if (event.target.matches(':focus-visible')) setVisible(true)
  }} onBlurCapture={() => setVisible(false)} onPointerDownCapture={() => setVisible(false)} onKeyDownCapture={event => {
    if (event.key === 'Escape' && shown) {
      event.preventDefault()
      event.stopPropagation()
      setVisible(false)
    } else if (event.key === 'Enter' || event.key === ' ') setVisible(false)
  }}>
    {cloneElement(children, {
      title: undefined,
      'aria-describedby': [children.props['aria-describedby'], shown ? id : undefined].filter(Boolean).join(' ') || undefined,
    })}
    {shown && <span id={id} role="tooltip" className="absolute top-1/2 left-full z-10 w-max max-w-64 -translate-y-1/2 pl-3">
      <span className="block rounded-control border border-line bg-overlay px-3 py-2 font-sans text-xs leading-5 font-medium text-ink shadow-soft">{label}</span>
    </span>}
  </span>
}
