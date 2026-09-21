import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // server-only throws outside a React Server environment; tests run in plain Node
      'server-only': fileURLToPath(new URL('./tests/empty.ts', import.meta.url)),
    },
  },
  test: { environment: 'node', css: true, server: { deps: { inline: [/@primer\/react/] } } },
})
