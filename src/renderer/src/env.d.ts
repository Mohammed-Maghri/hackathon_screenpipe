/// <reference types="vite/client" />
interface Window {
  ghost?: {
    browser: import('../../shared/browser').TeachingBrowser
    platform: string
    controlWindow: (action: 'minimize' | 'maximize' | 'close') => void
  }
}
