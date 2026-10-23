// Draws the overlay twice, from the GeoJSON the tiles were cut from and from the tiles, at several zooms, and fails if
// the two pictures differ (`make overlay-parity`).
// Needs Chrome: CHROME=/path/to/chrome, or the macOS default. PARITY_SHOTS=<dir> keeps the screenshots.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import puppeteer, { type Page } from 'puppeteer-core'
import { decodePolyline } from '../src/lib/data/polyline.ts'
import { OVERLAY_MAX_ZOOM, OVERLAY_SOURCE, OVERLAY_TILE_LAYER, overlayLayers } from '../src/lib/map/overlay.ts'

const APP = join(import.meta.dirname, '..')
const MAPLIBRE = join(APP, 'node_modules/maplibre-gl/dist')
const TILES = join(APP, 'public/data/overlay')
const TWISTIES = join(APP, '../data/interim/twisties.json')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const VIEWPORT = { width: 360, height: 780, deviceScaleFactor: 2 }
/** A pixel differs when any channel moves by more than this, out of 255. */
const PIXEL_TOLERANCE = 24
/**
 * Share of the picture allowed to differ. Up to the last zoom but one the tiles are MapLibre's own cut, so the pictures
 * match (measured 0 to 0.003%); anything structural, like a lost vertex, shows above 0.1%. From the last zoom the tiles
 * keep every vertex and the GeoJSON path does not, and the deeper views stretch them: lines shift by under a device
 * pixel (measured 0.01 to 0.17%).
 */
const MAX_DIFFERING_SHARE = { coarse: 0.0001, deep: 0.002 }
const SETTLE_MS = 500

const { twisties } = JSON.parse(readFileSync(TWISTIES, 'utf8')) as { twisties: { rating: number; line: string }[] }
const roads = twisties.map(({ rating, line }) => ({ rating, line: decodePolyline(line) }))
const geojson = JSON.stringify({
  type: 'FeatureCollection',
  features: roads.map(({ rating, line }) => ({ type: 'Feature', properties: { rating }, geometry: { type: 'LineString', coordinates: line } })),
})
// Overzoom views sit on a vertex of a real road: the stretch of the longest epic road.
const longest = roads.filter((road) => road.rating === 5).sort((a, b) => b.line.length - a.line.length)[0]
const onRoad = longest.line[Math.floor(longest.line.length / 2)]
const VIEWS = [
  { name: 'z5 Spain', zoom: 5, center: [-3.7, 40.2] },
  { name: 'z8 Pyrenees', zoom: 8, center: [0.5, 42.5] },
  { name: 'z11 Benasque', zoom: 11, center: [0.52, 42.6] },
  { name: 'z12 Gredos', zoom: 12, center: [-5.4, 40.3] },
  { name: `z${OVERLAY_MAX_ZOOM + 2} on a road`, zoom: OVERLAY_MAX_ZOOM + 2, center: onRoad },
  { name: `z${OVERLAY_MAX_ZOOM + 4} on a road`, zoom: OVERLAY_MAX_ZOOM + 4, center: onRoad },
]

const page = (origin: string, mode: 'geojson' | 'tiles', view: { zoom: number; center: number[] }) => {
  const source = mode === 'tiles'
    ? { type: 'vector', tiles: [`${origin}/overlay/{z}/{x}/{y}.pbf`], maxzoom: OVERLAY_MAX_ZOOM }
    : { type: 'geojson', data: `${origin}/twisties.geojson` }
  const style = {
    version: 8,
    sources: { [OVERLAY_SOURCE]: source },
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b0e14' } }, ...overlayLayers(mode === 'tiles' ? OVERLAY_TILE_LAYER : undefined)],
  }
  return `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/maplibre-gl.css>
<style>html,body,#map{margin:0;height:100%}</style><div id=map></div>
<script type=module>
import * as maplibre from '/maplibre-gl.mjs'
maplibre.setWorkerUrl('/maplibre-gl-worker.mjs')
window.errors = []
const map = window.map = new maplibre.Map({ container: 'map', style: ${JSON.stringify(style)}, center: ${JSON.stringify(view.center)}, zoom: ${view.zoom}, fadeDuration: 0, attributionControl: false })
map.on('error', (event) => window.errors.push(String(event.error?.message ?? event.error)))
</script>`
}

const TYPES: Record<string, string> = { '.mjs': 'text/javascript', '.css': 'text/css', '.pbf': 'application/x-protobuf' }
const server = createServer((request, response) => {
  const [path, query] = (request.url ?? '/').split('?')
  const send = (body: string | Buffer, type: string) => response.writeHead(200, { 'content-type': type }).end(body)
  if (path === '/page') {
    const params = new URLSearchParams(query)
    return send(page(`http://${request.headers.host}`, params.get('mode') as 'geojson' | 'tiles', { zoom: Number(params.get('zoom')), center: JSON.parse(params.get('center')!) }), 'text/html')
  }
  if (path === '/twisties.geojson') return send(geojson, 'application/json')
  const file = path.startsWith('/overlay/') ? join(TILES, path.slice('/overlay/'.length)) : join(MAPLIBRE, path.slice(1))
  try {
    send(readFileSync(file), TYPES[extname(file)] ?? 'application/octet-stream')
  } catch {
    response.writeHead(404).end()
  }
})
await new Promise<void>((resolve) => server.listen(0, resolve))
const origin = `http://localhost:${(server.address() as { port: number }).port}`

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle'] })

async function shoot(mode: 'geojson' | 'tiles', view: { zoom: number; center: number[] }): Promise<{ png: Uint8Array; errors: string[] }> {
  const tab = await browser.newPage()
  await tab.setViewport(VIEWPORT)
  await tab.goto(`${origin}/page?mode=${mode}&zoom=${view.zoom}&center=${JSON.stringify(view.center)}`)
  const layer = mode === 'tiles' ? OVERLAY_TILE_LAYER : undefined
  await tab.waitForFunction(
    (sourceLayer) => (window as never as { map: { areTilesLoaded(): boolean; querySourceFeatures(source: string, options: object): unknown[] } }).map.areTilesLoaded()
      && (window as never as { map: { querySourceFeatures(source: string, options: object): unknown[] } }).map.querySourceFeatures('twisties', { sourceLayer }).length > 0,
    { timeout: 60_000, polling: 250 },
    layer,
  )
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
  const png = await tab.screenshot({ type: 'png' })
  const errors = await tab.evaluate(() => (window as never as { errors: string[] }).errors)
  await tab.close()
  return { png, errors }
}

async function differingShare(diffPage: Page, a: Uint8Array, b: Uint8Array): Promise<number> {
  const url = (png: Uint8Array) => `data:image/png;base64,${Buffer.from(png).toString('base64')}`
  return diffPage.evaluate(async (first, second, tolerance) => {
    const pixels = async (src: string) => {
      const image = new Image()
      image.src = src
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, image.width, image.height).data
    }
    const [x, y] = [await pixels(first), await pixels(second)]
    let differing = 0
    for (let i = 0; i < x.length; i += 4) if (Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])) > tolerance) differing++
    return differing / (x.length / 4)
  }, url(a), url(b), PIXEL_TOLERANCE)
}

let failed = false
const diffPage = await browser.newPage()
for (const view of VIEWS) {
  const [fromGeojson, fromTiles] = [await shoot('geojson', view), await shoot('tiles', view)]
  if (process.env.PARITY_SHOTS) {
    mkdirSync(process.env.PARITY_SHOTS, { recursive: true })
    for (const [mode, shot] of [['geojson', fromGeojson], ['tiles', fromTiles]] as const) writeFileSync(join(process.env.PARITY_SHOTS, `${view.zoom}-${mode}.png`), shot.png)
  }
  const share = await differingShare(diffPage, fromGeojson.png, fromTiles.png)
  const ok = share <= (view.zoom < OVERLAY_MAX_ZOOM ? MAX_DIFFERING_SHARE.coarse : MAX_DIFFERING_SHARE.deep)
  failed ||= !ok
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${view.name.padEnd(20)} ${(share * 100).toFixed(3)}% of pixels differ`)
}

await browser.close()
server.close()
process.exit(failed ? 1 : 0)
