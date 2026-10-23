// Cuts the pipeline's twisties into the vector tiles the app draws as its Spain-wide overlay (`make overlay`).
//   node scripts/overlay-tiles.ts [--input ../data/interim/twisties.json] [--output public/data/overlay]
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { decodePolyline } from '../src/lib/data/polyline.ts'
import { cutOverlayTiles } from './overlayTiles.ts'

const arg = (name: string, fallback: string) => {
  const at = process.argv.indexOf(`--${name}`)
  return resolve(at > 0 ? process.argv[at + 1] : fallback)
}
const input = arg('input', join(import.meta.dirname, '../../data/interim/twisties.json'))
const output = arg('output', join(import.meta.dirname, '../public/data/overlay'))

const { twisties } = JSON.parse(readFileSync(input, 'utf8')) as { twisties: { rating: number; line: string }[] }
const tiles = cutOverlayTiles(twisties.map(({ rating, line }) => ({ rating, line: decodePolyline(line) })))

rmSync(output, { recursive: true, force: true })
let bytes = 0
for (const [key, tile] of tiles) {
  const file = join(output, `${key}.pbf`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, tile)
  bytes += tile.length
}
console.log(`overlay: ${twisties.length.toLocaleString()} twisties, ${tiles.size.toLocaleString()} tiles, ${(bytes / 1e6).toFixed(1)} MB in ${output}`)
