import type { LucideIcon } from 'lucide-react'
export function FeatureRow({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: string }) {
  return <li className="feature"><span className="feature-icon"><Icon size={22} strokeWidth={1.6} /></span><div><h2>{title}</h2><p>{children}</p></div></li>
}
