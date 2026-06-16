import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-utils/setup.ts',
    globals: true,
    // Heavy modules (e.g. AWS SDK) re-imported after vi.resetModules() can take
    // longer than the 5s default on slow/CI runners. Give tests/hooks more room
    // to avoid flaky timeouts.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
