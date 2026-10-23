import { spawnSync } from 'node:child_process'
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'
import { describe, expect, it } from 'vitest'
import type { LonLat } from '../src/lib/geo'
import { OVERLAY_MAX_ZOOM, OVERLAY_TILE_EXTENT, OVERLAY_TILE_LAYER } from '../src/lib/map/overlay'
import { cutOverlayTiles } from './overlayTiles'

function tileKey([lon, lat]: LonLat, zoom: number): string {
  const n = 2 ** zoom
  const x = Math.floor(((lon + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n)
  return `${zoom}/${x}/${y}`
}

function features(tile: Uint8Array) {
  const layer = new VectorTile(new PbfReader(tile)).layers[OVERLAY_TILE_LAYER]
  return { extent: layer.extent, ratings: Array.from({ length: layer.length }, (_, i) => layer.feature(i).properties.rating) }
}

// Two winding stretches in the Pyrenees and the Gredos, far enough apart to share no tile above zoom 4.
const benasque: LonLat[] = [[0.52, 42.6], [0.53, 42.605], [0.54, 42.6], [0.55, 42.607]]
const gredos: LonLat[] = [[-5.4, 40.3], [-5.39, 40.31], [-5.38, 40.3]]
const roads = [{ rating: 4, line: benasque }, { rating: 2, line: gredos }]

describe('cutOverlayTiles', () => {
  const tiles = cutOverlayTiles(roads)

  it('keeps every road, with its rating, in the tile of the last zoom that holds it', () => {
    for (const { rating, line } of roads) {
      const tile = tiles.get(tileKey(line[0], OVERLAY_MAX_ZOOM))
      expect(tile).toBeDefined()
      expect(features(tile!).ratings).toContain(rating)
    }
  })

  it('writes the extent MapLibre uses for its own GeoJSON tiles', () => {
    expect(features(tiles.get(tileKey(benasque[0], 5))!).extent).toBe(OVERLAY_TILE_EXTENT)
  })

  it('leaves out tiles with no road, which MapLibre reads as empty', () => {
    expect(tiles.has(tileKey([-10, 30], 5))).toBe(false)
    expect(tiles.has(tileKey([-10, 30], OVERLAY_MAX_ZOOM))).toBe(false)
  })

  it('has no tile deeper than the last zoom', () => {
    const deepest = Math.max(...[...tiles.keys()].map((key) => Number(key.split('/')[0])))
    expect(deepest).toBe(OVERLAY_MAX_ZOOM)
  })
})

// `make overlay` and `make overlay-parity` run under plain Node, which resolves no relative import without its
// extension. Vitest resolves them, so only a real Node run catches one.
describe('the overlay scripts', () => {
  it('load under plain Node', () => {
    const modules = ['./overlayTiles.ts', '../src/lib/map/overlay.ts'].map((path) => new URL(path, import.meta.url).href)
    const script = modules.map((module) => `await import(${JSON.stringify(module)})`).join('\n')
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { encoding: 'utf8' })
    expect(run.status, run.stderr).toBe(0)
  })
})
