import { Minus, Square, X } from './ImageIcon'

export function TitleBar({ onSkip }: { onSkip?: () => void }) {
  const desktop = window.ghost
  return <header className={`titlebar relative z-1 flex h-12 shrink-0 items-center justify-end pr-3 ${desktop?.platform === 'darwin' ? 'titlebar--mac' : ''}`}>
    <div className="titlebar-drag app-drag absolute inset-0" onDoubleClick={() => desktop?.controlWindow('maximize')} />
    {onSkip && <button className="skip relative rounded-lg px-5 py-2.5 text-xs text-muted hover:bg-sunken hover:text-ink" onClick={onSkip}>Skip intro</button>}
    {desktop && desktop.platform !== 'darwin' && <div className="window-controls relative flex gap-1 pl-2">
      <button className="grid h-8 w-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink" aria-label="Minimize window" onClick={() => desktop.controlWindow('minimize')}><Minus size={15} /></button>
      <button className="grid h-8 w-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink" aria-label="Maximize or restore window" onClick={() => desktop.controlWindow('maximize')}><Square size={12} /></button>
      <button className="grid h-8 w-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger" aria-label="Close window" onClick={() => desktop.controlWindow('close')}><X size={16} /></button>
    </div>}
  </header>
}
