import type { ImageIcon } from './ImageIcon'
export function FeatureRow({ icon: Icon, title, children }: { icon: ImageIcon; title: string; children: string }) {
  return <li className="feature"><span className="feature-icon"><Icon size={22} strokeWidth={1.6} /></span><div><h2>{title}</h2><p>{children}</p></div></li>
}
