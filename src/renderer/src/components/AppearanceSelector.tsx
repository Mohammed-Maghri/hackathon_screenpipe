import { Monitor, Moon, Sun } from 'lucide-react'
import { setThemePreference, useAppearance } from '../theme/appearance'

const choices = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function AppearanceSelector({ compact = false }: { compact?: boolean }) {
  const { preference } = useAppearance()
  return <fieldset className={`appearance-selector min-w-0 border-0 p-0 ${compact ? '' : 'my-5'}`}>
    <legend className={compact ? 'sr-only' : 'mb-3 text-sm font-medium text-ink'}>Appearance</legend>
    <div className="inline-flex max-w-full flex-wrap gap-1 rounded-control border border-line bg-canvas p-1">
      {choices.map(({ value, label, icon: Icon }) => <button key={value} type="button" value={value} aria-pressed={preference === value} onClick={() => setThemePreference(value)} className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-sm border px-3 py-2 text-xs transition-colors ${preference === value ? 'border-strong bg-panel font-medium text-ink' : 'border-transparent text-muted hover:bg-sunken hover:text-ink'}`}><Icon size={15} /><span>{label}</span></button>)}
    </div>
    {!compact && <p className="mt-3 text-xs leading-relaxed text-muted">System follows your device’s appearance. Your choice is saved on this device.</p>}
  </fieldset>
}
