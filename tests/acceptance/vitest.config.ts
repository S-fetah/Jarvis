import { defineConfig } from 'vitest/config'

// MVP acceptance suite (plan §8, Tests A–G). Kept out of `npm test` on purpose:
// it is a scoreboard of release readiness, and red here means "not MVP yet".
export default defineConfig({
  test: {
    include: ['tests/acceptance/**/*.accept.ts']
  }
})
