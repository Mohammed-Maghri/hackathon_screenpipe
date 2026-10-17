import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link, Plus } from './ImageIcon'
import { ToolbarTooltip } from './ToolbarTooltip'

export function CanvasAddMenu({ onChoose }: { onChoose: (action: 'Add node' | 'Add connection') => void }) {
  const menuId = useId()
  const menu = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  function focusItem(last = false) {
    const items = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    items?.[last ? items.length - 1 : 0]?.focus()
  }
  function choose(action: 'Add node' | 'Add connection') {
    menu.current?.hidePopover()
    trigger.current?.focus()
    onChoose(action)
  }
  function navigateMenu(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
      items[next]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      menu.current?.hidePopover()
      trigger.current?.focus()
    } else if (event.key === 'Tab') {
      menu.current?.hidePopover()
      trigger.current?.focus()
    }
  }

  return <>
    <ToolbarTooltip label="Add node or connection" suppressed={open}><button ref={trigger} type="button" aria-label="Add to workflow" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} popoverTarget={menuId} className="[anchor-name:--canvas-add]" onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        menu.current?.showPopover()
        focusItem(event.key === 'ArrowUp')
      }
    }}><Plus size={20} /></button></ToolbarTooltip>
    <div ref={menu} id={menuId} popover="auto" role="menu" aria-label="Add to workflow" onToggle={event => {
      setOpen(event.newState === 'open')
      if (event.newState === 'open') focusItem()
    }} onKeyDown={navigateMenu} className="canvas-add-menu fixed inset-auto top-[anchor(top)] left-[calc(anchor(right)+8px)] m-0 w-56 rounded-control border border-line bg-overlay p-1.5 text-ink shadow-float [position-anchor:--canvas-add] [position-try-fallbacks:flip-block,flip-inline] [&>button]:flex [&>button]:min-h-10 [&>button]:w-full [&>button]:items-center [&>button]:gap-3 [&>button]:rounded-sm [&>button]:px-3 [&>button]:py-2 [&>button]:text-left [&>button]:font-sans [&>button]:text-sm [&>button]:hover:bg-sunken [&>button]:focus-visible:bg-sunken [&>button]:focus-visible:outline-offset-0 [&_svg]:text-muted">
      <button type="button" role="menuitem" onClick={() => choose('Add node')}><Plus size={16} />Add node</button>
      <button type="button" role="menuitem" onClick={() => choose('Add connection')}><Link size={16} />Add connection</button>
    </div>
  </>
}
