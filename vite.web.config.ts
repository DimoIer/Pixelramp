import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve('src/renderer'),
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/*.tmpdir/**', '**/.*.tmpdir/**', '**/*.tmp']
    }
  },
  build: {
    outDir: resolve('dist-web'),
    emptyOutDir: true
  }
})
