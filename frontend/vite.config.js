import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, proxy /api to the Go backend so the browser talks to Vite's own
// origin — no CORS needed. In production nginx does the same proxying, so the
// frontend can always use relative /api paths.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
