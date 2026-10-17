import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Database, Info, Monitor, Search, Settings as SettingsIcon, X } from 'lucide-react'
import { Link, Navigate, useLocation, useParams, type Location } from 'react-router'
import { AppearanceSelector } from '../components/AppearanceSelector'
import { TitleBar } from '../components/TitleBar'

const sections = [
  { id: 'general', title: 'General', description: 'App information and navigation.', icon: SettingsIcon },
  { id: 'appearance', title: 'Appearance', description: 'Theme and window appearance.', icon: Monitor },
  { id: 'workspace', title: 'Workspace info', description: 'Where your workflows and activity come from.', icon: Database },
] as const

type SectionId = typeof sections[number]['id']
const settingRows: { id: string; section: SectionId; title: string; description: string; value?: string; keywords?: string }[] = [
  { id: 'version', section: 'general', title: 'Version', description: 'Ghost desktop.', value: '0.1.0' },
  { id: 'welcome', section: 'general', title: 'Welcome', description: 'Return to the introduction.', keywords: 'back welcome introduction home' },
  { id: 'theme', section: 'appearance', title: 'Theme', description: 'System follows your device’s appearance. Your choice is saved on this device.', keywords: 'light dark system color colour appearance' },
  { id: 'source', section: 'workspace', title: 'Data source', description: 'Discovery searches your configured local Screenpipe history.', value: 'Screenpipe' },
  { id: 'saved', section: 'workspace', title: 'Saved workflows', description: 'Saved workflows use your configured backend.', value: 'Configured backend' },
  { id: 'drafts', section: 'workspace', title: 'Imported drafts', description: 'Imported drafts remain available across pages until you reload the app.', value: 'Session only' },
]

function returnPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard'
  try {
    const target = new URL(value, 'https://ghost.local')
    if (target.origin !== 'https://ghost.local' || !/^\/(?:dashboard|workflows(?:\/[^/?#]+(?:\/record\/[^/?#]+)?)?)?\/?$/.test(target.pathname)) return '/dashboard'
    return target.pathname + target.search + target.hash
  } catch { return '/dashboard' }
}

export function getSettingsBackground(value: unknown): Location | undefined {
  if (!value || typeof value !== 'object') return
  const candidate = value as Partial<Location>
  if (typeof candidate.pathname !== 'string') return
  const search = typeof candidate.search === 'string' ? candidate.search : ''
  const hash = typeof candidate.hash === 'string' ? candidate.hash : ''
  const path = candidate.pathname + search + hash
  if (returnPath(path) !== path) return
  return { pathname: candidate.pathname, search, hash, state: candidate.state ?? null, key: typeof candidate.key === 'string' ? candidate.key : 'settings-background' }
}

const appearanceChoices = "[&_.appearance-selector>div]:gap-5 [&_.appearance-selector>div]:rounded-none [&_.appearance-selector>div]:border-0 [&_.appearance-selector>div]:bg-transparent [&_.appearance-selector>div]:p-0 [&_.appearance-selector_button]:gap-2 [&_.appearance-selector_button]:rounded-none [&_.appearance-selector_button]:border-0 [&_.appearance-selector_button]:bg-transparent [&_.appearance-selector_button]:px-0 [&_.appearance-selector_button]:font-sans [&_.appearance-selector_button]:text-sm [&_.appearance-selector_button]:before:size-3.5 [&_.appearance-selector_button]:before:rounded-full [&_.appearance-selector_button]:before:border-2 [&_.appearance-selector_button]:before:border-muted [&_.appearance-selector_button]:before:content-[''] [&_.appearance-selector_button[aria-pressed=true]]:before:border-4 [&_.appearance-selector_button[aria-pressed=true]]:before:border-ink"

export function Settings() {
  const { section: sectionParam } = useParams()
  const location = useLocation()
  const state = location.state as { returnTo?: unknown; backgroundLocation?: unknown } | null
  const backgroundLocation = getSettingsBackground(state?.backgroundLocation)
  const returnTo = returnPath(state?.returnTo ?? (backgroundLocation ? backgroundLocation.pathname + backgroundLocation.search + backgroundLocation.hash : undefined))
  const navigationState = { returnTo, ...(backgroundLocation ? { backgroundLocation } : {}) }
  const section = sections.find(item => item.id === (sectionParam ?? 'general'))
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(!window.ghost?.browser)
  const heading = useRef<HTMLHeadingElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const normalized = query.trim().toLocaleLowerCase()
  const matches = settingRows.filter(row => {
    if (!normalized) return row.section === section?.id
    return [row.title, row.description, row.value, row.keywords, sections.find(item => item.id === row.section)?.title].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalized)
  })

  useLayoutEffect(() => {
    const browser = window.ghost?.browser
    const modalId = crypto.randomUUID()
    let disposed = false
    if (browser) void browser.modal(modalId, true).then(() => { if (!disposed) setVisible(true) }).catch(() => { /* Keep the page hidden if the native view cannot be occluded. */ })
    else setVisible(true)
    return () => { disposed = true; if (browser) void browser.modal(modalId, false).catch(() => {}) }
  }, [])
  useLayoutEffect(() => { if (visible) heading.current?.focus({ preventScroll: true }) }, [visible, sectionParam])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); search.current?.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }) }, [sectionParam, normalized])

  if (!section) return <Navigate replace to="/settings" state={navigationState} />
  const groups = normalized ? sections.filter(item => matches.some(row => row.section === item.id)) : [section]
  return <div className={`settings-shell fixed inset-0 z-40 flex flex-col overflow-hidden bg-canvas font-sans text-ink ${visible ? '' : 'invisible pointer-events-none'}`}>
    <div className="settings-windowbar h-10 shrink-0 bg-canvas [&>.titlebar]:h-10"><TitleBar /></div>
    <div className="flex min-h-0 flex-1">
      <aside className="settings-sidebar flex w-60 shrink-0 flex-col border-r border-sidebar-line bg-sidebar text-sidebar-ink" aria-label="Settings sidebar">
        <Link to={returnTo} aria-label="Back to app" className="app-no-drag flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-line px-6 font-sans text-sm font-semibold text-sidebar-muted hover:text-sidebar-ink"><ArrowLeft size={16} />Back to app</Link>
        <div className="px-3 pt-4 pb-3">
          <label className="flex h-9 items-center gap-2 rounded-control border border-sidebar-line px-2.5 text-sidebar-muted focus-within:border-sidebar-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-action">
            <Search size={15} /><input ref={search} type="search" aria-label="Search settings" placeholder="Search settings" maxLength={200} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery('') }} className="min-w-0 w-full border-0 bg-transparent font-mono text-xs text-sidebar-ink outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none" />
            {query ? <button type="button" aria-label="Clear settings search" className="grid size-5 shrink-0 place-items-center rounded-sm hover:text-sidebar-ink" onClick={() => { setQuery(''); search.current?.focus() }}><X size={13} /></button> : <kbd className="shrink-0 rounded border border-sidebar-line px-1 py-0.5 font-mono text-[9px] leading-none">{window.ghost?.platform === 'darwin' ? '⌘K' : '⌃K'}</kbd>}
          </label>
        </div>
        <nav aria-label="Settings sections" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <p className="mb-2 px-2 font-sans text-[11px] font-semibold text-sidebar-muted">App</p>
          <div className="grid gap-1">{sections.map(({ id, title, icon: Icon }) => <Link key={id} to={`/settings/${id}`} state={navigationState} onClick={() => setQuery('')} aria-current={!normalized && section.id === id ? 'page' : undefined} className="settings-section-link relative flex min-h-9 items-center gap-2.5 rounded-control border border-transparent px-2.5 font-sans text-[13px] font-semibold text-sidebar-muted hover:bg-nav-active hover:text-sidebar-ink aria-[current=page]:border-sidebar-selected-line aria-[current=page]:bg-nav-active aria-[current=page]:text-sidebar-ink"><Icon size={16} strokeWidth={1.7} />{title}</Link>)}</div>
        </nav>
        <p className="shrink-0 border-t border-sidebar-line px-5 py-4 font-mono text-[10px] text-sidebar-muted">Ghost · 0.1.0</p>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="settings-header flex h-16 shrink-0 items-center border-b border-line px-6"><h1 ref={heading} tabIndex={-1} className="text-lg font-semibold tracking-normal outline-none">{normalized ? 'Search results' : section.title}</h1></header>
        <div ref={scroll} className="settings-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 [scrollbar-gutter:stable] min-[1600px]:px-8">
          <p className="mb-5 text-sm leading-relaxed text-muted">{normalized ? `Settings matching “${query.trim()}”.` : section.description}</p>
          {matches.length ? groups.map(group => <section key={group.id} aria-label={group.title} className="mb-6">
            {normalized && <h2 className="mb-3 text-sm font-semibold tracking-normal">{group.title}</h2>}
            <div className="grid gap-2">{matches.filter(row => row.section === group.id).map(row => <article key={row.id} data-setting={row.id} className="setting-card flex items-start gap-3 rounded-card border border-line bg-panel p-4">
              {row.id === 'theme' ? <Monitor size={18} className="mt-0.5 text-muted" /> : row.section === 'workspace' ? <Database size={18} className="mt-0.5 text-muted" /> : <Info size={18} className="mt-0.5 text-muted" />}
              <div className="min-w-0 flex-1">
                <div className={`flex items-center justify-between gap-4 ${row.id === 'theme' ? '' : 'max-[1000px]:flex-wrap max-[1000px]:gap-3'}`}>
                  <div className="min-w-0"><h2 className="text-sm font-semibold tracking-normal">{row.title}</h2>{row.id !== 'theme' && <p className="mt-1 text-[13px] leading-relaxed text-muted">{row.description}</p>}</div>
                  {row.value && <span className="shrink-0 font-mono text-xs text-muted">{row.value}</span>}
                  {row.id === 'welcome' && <Link to="/" className="dash-button shrink-0 font-mono text-xs">Back to welcome <ArrowUpRight size={14} /></Link>}
                </div>
                {row.id === 'theme' && <div className={`mt-3 ${appearanceChoices}`}><AppearanceSelector compact /><p className="mt-3 text-[13px] leading-relaxed text-muted">{row.description}</p></div>}
              </div>
            </article>)}</div>
          </section>) : <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-card border border-line bg-panel px-6 py-10 text-center" role="status"><Search size={24} className="text-muted" /><h2 className="text-base font-semibold tracking-normal">No settings found</h2><p className="text-sm text-muted">Try searching for theme, version, or data.</p><button type="button" className="dash-button mt-2" onClick={() => { setQuery(''); search.current?.focus() }}>Clear search</button></div>}
        </div>
      </main>
    </div>
  </div>
}
