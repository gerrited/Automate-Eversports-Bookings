import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    setupFiles: './src/test-setup.ts',
    coverage: {
      provider: 'v8',
      // json-summary + json braucht die Coverage-Report-Action in der CI,
      // lcov der Codecov-Upload
      reporter: ['text', 'json-summary', 'json', 'lcov'],
      include: ['src/**'],
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
