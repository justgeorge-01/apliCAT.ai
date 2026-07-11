import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// GitHub Pages serves a project site from a sub-path (/<repo>/). A relative
// base makes the built assets path-independent, so the site works under any
// repo name without hardcoding it. Overridable via BASE_PATH when needed.
const base = process.env.BASE_PATH || './'

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
