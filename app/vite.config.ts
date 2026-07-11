import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// GitHub Pages serves the site from a sub-path. Overridable for local preview
// or for deploying the new app to a nested path next to the legacy site.
const base = process.env.BASE_PATH || '/admitica-ai/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      // allow importing the shared legacy data modules from the repo root
      allow: ['..'],
    },
  },
})
