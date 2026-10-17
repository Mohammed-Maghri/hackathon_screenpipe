import type { ImageIcon } from './ImageIcon'

export function FeatureRow({ icon: Icon, title, children, tone = 'blue' }: { icon: ImageIcon; title: string; children: string; tone?: 'blue' | 'peach' | 'lilac' }) {
  const tones = { blue: 'bg-action-soft text-action', peach: 'bg-peach text-peach-ink', lilac: 'bg-lilac text-lilac-ink' }
  return <li className="feature flex items-center gap-3">
    <span className={`feature-icon grid size-10 shrink-0 place-items-center rounded-control border border-line ${tones[tone]}`}><Icon size={20} strokeWidth={1.6} /></span>
    <div><h2 className="mb-1 text-sm leading-snug font-medium tracking-normal">{title}</h2><p className="text-xs leading-relaxed text-muted">{children}</p></div>
  </li>
}
