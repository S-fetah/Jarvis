import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// MVP acceptance suite (plan §8, Tests A–G). Kept out of `npm test` on purpose:
// it is a scoreboard of release readiness, and red here means "not MVP yet".
export default defineConfig({
  resolve: {
    alias: {
      '@jarvis/protocol': resolve(__dirname, '../../packages/protocol/src/index.ts'),
      '@jarvis/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@jarvis/voice': resolve(__dirname, '../../packages/voice/src/index.ts'),
      '@shared': resolve(__dirname, '../../packages/protocol/src')
    }
  },
  test: {
    include: ['tests/acceptance/**/*.accept.ts']
  }
})
