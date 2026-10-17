import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({ root: 'src/renderer', plugins: [react(), tailwindcss(), {
  name: 'desktop-preview-notice',
  transformIndexHtml() {
    return [{ tag: 'aside', attrs: { role: 'status', style: 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;padding:8px 16px;background:#ffe14a;color:#141414;text-align:center;font:13px sans-serif' }, children: 'Ghost web preview — open the Electron app for backend workflow management, recording and replay.', injectTo: 'body' }]
  },
}] })
