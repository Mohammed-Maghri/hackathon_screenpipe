import { useSyncExternalStore } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ColorTheme = 'light' | 'dark'
const storageKey = 'ghost.appearance'
const system = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()
const valid = (value: unknown): value is ThemePreference => value === 'light' || value === 'dark' || value === 'system'
function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(storageKey)
    return valid(saved) ? saved : 'dark'
  } catch { return 'dark' }
}
let preference = readPreference()
let snapshot = { preference, resolved: resolve(preference) }
let initialized = false
function resolve(value: ThemePreference): ColorTheme {
  return value === 'system' ? (system.matches ? 'dark' : 'light') : value
}
function apply() {
  snapshot = { preference, resolved: resolve(preference) }
  const root = document.documentElement
  root.dataset.theme = snapshot.resolved
  root.dataset.themePreference = preference
  root.style.colorScheme = snapshot.resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).backgroundColor)
  // Update the app window's backing color only. Guest websites retain their
  // own appearance preferences; never inject theme CSS into the teaching view.
  void window.ghost?.setAppearance?.(snapshot.resolved).catch(() => {})
  listeners.forEach(listener => listener())
}
export function initializeAppearance() {
  if (initialized) return
  initialized = true
  system.addEventListener('change', () => { if (preference === 'system') apply() })
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return
    preference = readPreference()
    apply()
  })
  apply()
}
export function setThemePreference(value: ThemePreference) {
  if (!valid(value)) return
  preference = value
  try { localStorage.setItem(storageKey, value) } catch { /* Retain the in-memory choice. */ }
  apply()
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function useAppearance() {
  return useSyncExternalStore(subscribe, () => snapshot)
}
