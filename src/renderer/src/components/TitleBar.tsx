import { Minus, Square, X } from 'lucide-react'
export function TitleBar({ onSkip }: { onSkip?: () => void }) {
  const desktop = window.ghost
  return <header className={`titlebar ${desktop?.platform === 'darwin' ? 'titlebar--mac' : ''}`}>
    <div className="titlebar-drag" onDoubleClick={() => desktop?.controlWindow('maximize')} />
    {onSkip && <button className="skip" onClick={onSkip}>Skip intro</button>}
    {desktop && desktop.platform !== 'darwin' && <div className="window-controls">
      <button aria-label="Minimize window" onClick={() => desktop.controlWindow('minimize')}><Minus size={15} /></button>
      <button aria-label="Maximize or restore window" onClick={() => desktop.controlWindow('maximize')}><Square size={12} /></button>
      <button aria-label="Close window" onClick={() => desktop.controlWindow('close')}><X size={16} /></button>
    </div>}
  </header>
}
