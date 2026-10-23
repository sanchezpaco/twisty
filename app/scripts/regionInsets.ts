import type { LonLat } from '../src/lib/geo'

/** Width of every picture in SVG units; the box draws it at about 1 unit per CSS pixel. */
export const INSET_WIDTH = 120
/** Thinning tolerance in SVG units: a third of a pixel at the largest box is below what the eye can tell. */
const SIMPLIFY_TOLERANCE = 0.35
/** Islets this small (diagonal, in units) are a speck at the box's size and only cost bytes. */
const MIN_SHAPE = 1.2

export interface InsetRoad {
  rating: number
  line: LonLat[]
}

export interface InsetPicture {
  /** South-west and north-east corners of what the picture frames. */
  bounds: [LonLat, LonLat]
  coast: LonLat[][]
  roads: InsetRoad[]
  coastColor: string
  /** Twisties shorter than this on the picture (in units) are left out: a whole country's are a smudge at this size. */
  minRoadLength: number
  /** Index = rating - 1. */
  ramp: readonly string[]
}

type Point = [number, number]

/**
 * A region drawn as its coast and its twisties, as the overview map shows them: strokes only, so the box's glass is the
 * sea and the land alike. Strokes keep their pixel width at any box size.
 */
export function insetSvg({ bounds, coast, roads, coastColor, ramp, minRoadLength }: InsetPicture): string {
  const project = projection(bounds)
  const height = Math.round(project(bounds[0])[1])
  const thin = (lines: LonLat[][]) => lines.map((line) => simplify(line.map(project), SIMPLIFY_TOLERANCE))
  // A coast comes in many ways; only a closed one is a whole islet that can be too small to draw.
  const shores = thin(chain(coast)).filter((line) => !(isClosed(line) && diagonal(line) < MIN_SHAPE))
  const coastPath = `<path d="${shores.map(pathData).join('')}" stroke="${coastColor}" stroke-width="1"/>`
  // Hotter roads are drawn last, on top, as on the map.
  const roadPaths = ramp
    .map((color, index) => {
      const lines = thin(roads.filter((road) => road.rating === index + 1).map((road) => road.line))
      const d = lines.filter((line) => length(line) >= minRoadLength).map(pathData).join('')
      return d && `<path d="${d}" stroke="${color}" stroke-width="1.1"/>`
    })
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${INSET_WIDTH} ${height}" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<style>path{vector-effect:non-scaling-stroke}</style>${coastPath}${roadPaths}</svg>\n`
  )
}

/**
 * The lines joined end to start wherever one ends where another begins, as the ways of a coast do, so a coast is thinned
 * as one line instead of keeping the ends of every short way.
 */
export function chain(lines: LonLat[][]): LonLat[][] {
  const key = ([lon, lat]: LonLat) => `${lon},${lat}`
  const byStart = new Map(lines.map((line, index) => [key(line[0]), index]))
  const used = new Set<number>()
  const chains: LonLat[][] = []
  // Starting from lines no other one leads into puts each open coast together whole; the closed loops are left after.
  const leadsInto = new Set(lines.map((line) => key(line[line.length - 1])))
  const order = [...lines.keys()].sort((a, b) => Number(leadsInto.has(key(lines[a][0]))) - Number(leadsInto.has(key(lines[b][0]))))
  for (const first of order) {
    if (used.has(first)) continue
    used.add(first)
    const joined = [...lines[first]]
    for (let next = byStart.get(key(joined[joined.length - 1])); next !== undefined && !used.has(next); next = byStart.get(key(joined[joined.length - 1]))) {
      used.add(next)
      joined.push(...lines[next].slice(1))
    }
    chains.push(joined)
  }
  return chains
}

/** Equirectangular at the frame's middle latitude, which at this size is indistinguishable from the map's Mercator. */
export function projection([[west, south], [east, north]]: InsetPicture['bounds']): (point: LonLat) => Point {
  const xScale = Math.cos((((south + north) / 2) * Math.PI) / 180)
  const scale = INSET_WIDTH / ((east - west) * xScale)
  return ([lon, lat]) => [(lon - west) * xScale * scale, (north - lat) * scale]
}

/** Douglas-Peucker: the fewest points that stay within `tolerance` of the line. */
export function simplify(line: Point[], tolerance: number): Point[] {
  if (line.length < 3) return line
  const first = line[0]
  const last = line[line.length - 1]
  let farthest = 0
  let farthestAt = 0
  for (let i = 1; i < line.length - 1; i++) {
    const distance = distanceToSegment(line[i], first, last)
    if (distance > farthest) {
      farthest = distance
      farthestAt = i
    }
  }
  if (farthest <= tolerance) return [first, last]
  return [...simplify(line.slice(0, farthestAt + 1), tolerance).slice(0, -1), ...simplify(line.slice(farthestAt), tolerance)]
}

function distanceToSegment([x, y]: Point, [x1, y1]: Point, [x2, y2]: Point): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

function length(line: Point[]): number {
  return line.slice(1).reduce((sum, [x, y], index) => sum + Math.hypot(x - line[index][0], y - line[index][1]), 0)
}

function isClosed(line: Point[]): boolean {
  const [x1, y1] = line[0]
  const [x2, y2] = line[line.length - 1]
  return x1 === x2 && y1 === y2
}

function diagonal(line: Point[]): number {
  const xs = line.map(([x]) => x)
  const ys = line.map(([, y]) => y)
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
}

const round = (value: number) => Math.round(value * 10) / 10

function pathData(line: Point[]): string {
  return 'M' + line.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')
}
