import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: { build: { rollupOptions: { input: { index: 'src/main/index.ts', 'processing-worker': 'src/main/dataProcessing/worker.ts' }, output: { entryFileNames: '[name].js' } } } },
  preload: { build: { rollupOptions: { input: { index: 'src/preload/index.ts', recorder: 'src/preload/recorder.ts' }, output: { format: 'cjs', entryFileNames: '[name].cjs' } } } },
  renderer: { plugins: [react(), tailwindcss()], build: { minify: true } },
})
