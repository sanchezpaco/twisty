// Draws the map's region box, the Canary Islands and mainland Spain, from the OpenStreetMap extracts and the pipeline's
// twisties (needs osmium-tool and `make data`'s downloads). The pictures are committed: run it again when the twisties
// of a region change a lot.
//   node scripts/region-insets.ts [--raw ../data/raw]
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { decodePolyline } from '../src/lib/data/polyline.ts'
import type { LonLat } from '../src/lib/geo'
import { CANARIES_BOUNDS, SPAIN_BOUNDS } from '../src/lib/map/regions.ts'
import { MAP_COLORS, RATING_COLORS } from '../src/lib/map/theme.ts'
import { insetSvg, type InsetPicture } from './regionInsets.ts'

const rawAt = process.argv.indexOf('--raw')
const RAW = resolve(rawAt > 0 ? process.argv[rawAt + 1] : join(import.meta.dirname, '../../data/raw'))
const TWISTIES = join(import.meta.dirname, '../../data/interim/twisties.json')
const ASSETS = join(import.meta.dirname, '../src/assets')
/** About 9 km of road: the longer twisties keep the picture's heat where the mountains are, in a few kilobytes. */
const MAINLAND_MIN_ROAD = 1

interface Way {
  properties: Record<string, string>
  geometry: { type: string; coordinates: LonLat[] }
}

/** The ways of an extract that match an osmium tag filter, as lines. */
function ways(extract: string, ...filters: string[]): Way[] {
  const scratch = mkdtempSync(join(tmpdir(), 'insets-'))
  try {
    const filtered = join(scratch, 'filtered.osm.pbf')
    const exported = join(scratch, 'ways.geojson')
    execFileSync('osmium', ['tags-filter', '-O', '-o', filtered, join(RAW, extract), ...filters])
    execFileSync('osmium', ['export', '-O', '-o', exported, '--geometry-types=linestring', filtered])
    return (JSON.parse(readFileSync(exported, 'utf8')).features as Way[]).filter((way) => way.geometry.type === 'LineString')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

const inside = ([[west, south], [east, north]]: InsetPicture['bounds']) => (line: LonLat[]) =>
  line.some(([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north)

const { twisties } = JSON.parse(readFileSync(TWISTIES, 'utf8')) as { twisties: { rating: number; line: string }[] }
const roads = twisties.map(({ rating, line }) => ({ rating, line: decodePolyline(line) }))

function draw(file: string, bounds: InsetPicture['bounds'], coast: LonLat[][], minRoadLength: number) {
  const svg = insetSvg({
    bounds,
    coast: coast.filter(inside(bounds)),
    roads: roads.filter((road) => inside(bounds)(road.line)),
    coastColor: MAP_COLORS.label,
    ramp: RATING_COLORS,
    minRoadLength,
  })
  writeFileSync(join(ASSETS, file), svg)
  console.log(`${file}: ${(svg.length / 1024).toFixed(1)} KB`)
}

draw('inset-canaries.svg', CANARIES_BOUNDS, ways('canary-islands-latest.osm.pbf', 'w/natural=coastline').map((way) => way.geometry.coordinates), 0)

// Spain's outline is its coast and its land borders; the sea borders are not drawn.
const mainland = ways('spain-latest.osm.pbf', 'w/natural=coastline', 'w/admin_level=2').filter(
  (way) => way.properties.natural === 'coastline' || way.properties.maritime !== 'yes',
)
draw('inset-mainland.svg', SPAIN_BOUNDS, mainland.map((way) => way.geometry.coordinates), MAINLAND_MIN_ROAD)
