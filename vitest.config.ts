import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@jarvis/protocol': resolve(__dirname, 'packages/protocol/src/index.ts'),
      '@jarvis/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@jarvis/voice': resolve(__dirname, 'packages/voice/src/index.ts'),
      '@shared': resolve(__dirname, 'packages/protocol/src')
    }
  },
  test: {
    exclude: ['tests/acceptance/**', 'node_modules/**', '**/dist/**', '**/out/**']
  }
})
