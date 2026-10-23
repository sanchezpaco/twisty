import { defineConfig } from 'vite'

// The bench is bundled for Node and needs no copy of the app's public folder (which holds the 170 MB of data).
export default defineConfig({ build: { copyPublicDir: false } })
