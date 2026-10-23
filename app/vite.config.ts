import { rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, type Plugin } from 'vite'
import { TRACKS_OFFERED } from './src/lib/offRoad.ts'

/** Public files are copied whole: while tracks are not offered, neither the APK nor the web build carries their layer. */
function dropTracks(): Plugin {
  let outDir = ''
  return {
    name: 'twisty:drop-tracks',
    apply: 'build',
    configResolved: (config) => {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle: () => rmSync(join(outDir, 'data/tracks.bin'), { force: true }),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), ...(TRACKS_OFFERED ? [] : [dropTracks()])],
})
