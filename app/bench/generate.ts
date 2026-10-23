import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { type Graph, parseGraph } from '../src/lib/data/graph'
import { parseTwisties, type Twisty } from '../src/lib/data/twisties'
import { haversineM, type LonLat, pointAlong } from '../src/lib/geo'
import { bidirectionalEdges } from '../src/lib/routing/bidirectional'
import { EdgeWeights } from '../src/lib/routing/edgeWeights'
import { NodeLocator } from '../src/lib/routing/nodeLocator'
import { ShortestPaths } from '../src/lib/routing/shortestPaths'
import { dataHash } from './dataHash'
import { fnv1a, mulberry32 } from './random'
import { isHoldoutRoad, type KnownRoadContext } from './greatRoads'
import type { KnownRoad } from './roads'
import type { BenchTrip } from './trips'
import { twistiesFile } from './twistiesFile'

export const SEED = 20261013
/** Share of the generated trips held out of tuning, by the 1° cell of their start. */
export const HOLDOUT_PERCENT = 30
/** A mountain trip has this many km of twisties rated at least `MOUNTAIN_MIN_RATING` near its straight line. */
export const MOUNTAIN_TWISTY_KM = 40
const MOUNTAIN_MIN_RATING = 3
const MOUNTAIN_CORRIDOR_KM = 15
export const MOUNTAIN_TRIPS = 35
const REGIONAL_KM: [number, number] = [50, 150]
/** A great-road trip starts and ends this far beyond each end of the road, so the road lies between A and B. */
const GREAT_BEYOND_KM: [number, number] = [20, 60]
/** How far from the line out of the road a great-road trip's end may lie. */
const GREAT_BEARING_SPREAD_DEG = 60
/** A scout's trip is reused when both its ends are this close to the ends of a trip we already have. */
const REUSE_WITHIN_M = 1_000
const MAX_TRIES = 5_000
const PLACE_KINDS = new Set(['city', 'town', 'village'])

type Place = [name: string, kind: string, lon: number, lat: number, context: string | null]

interface TripsFile {
  seed: number
  generatedOn?: { dataHash: string; placesHash: string; twistiesHash: string }
  /** Trips taken out for good, with the reason: `generate` does not make them again. */
  retired?: { id: string; reason: string }[]
  trips: GeneratedTrip[]
}
type GeneratedTrip = BenchTrip & { splitKey?: string }

const sha = (text: string | Buffer) => createHash('sha256').update(text).digest('hex').slice(0, 16)

/** The point `km` away from `from` along `bearing` degrees clockwise from north. */
export function destination(from: LonLat, bearingDeg: number, km: number): LonLat {
  const [lon, lat] = from
  const angle = (bearingDeg * Math.PI) / 180
  const dLat = (km * Math.cos(angle)) / 111.32
  const dLon = (km * Math.sin(angle)) / (111.32 * Math.cos((lat * Math.PI) / 180))
  return [lon + dLon, lat + dLat]
}

/** The compass bearing in degrees clockwise from north of the straight line from one point to another, on a local flat map. */
export function bearingDeg(from: LonLat, to: LonLat): number {
  const scale = Math.cos((from[1] * Math.PI) / 180)
  return ((Math.atan2((to[0] - from[0]) * scale, to[1] - from[1]) * 180) / Math.PI + 360) % 360
}

/** Distance in km from a point to the straight segment between two others, on a local flat map. */
export function distanceToLineKm(point: LonLat, a: LonLat, b: LonLat): number {
  const scale = Math.cos((point[1] * Math.PI) / 180)
  const [bx, by] = [(b[0] - a[0]) * scale, b[1] - a[1]]
  const [px, py] = [(point[0] - a[0]) * scale, point[1] - a[1]]
  const lengthSquared = bx * bx + by * by
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared))
  return Math.hypot(px - bx * t, py - by * t) * 111.32
}

/** Km of well-rated twisties whose middle lies near the straight line from `from` to `to`. */
export function mountainKm(twisties: Twisty[], from: LonLat, to: LonLat): number {
  return twisties
    .filter((twisty) => twisty.rating >= MOUNTAIN_MIN_RATING)
    .filter((twisty) => distanceToLineKm(pointAlong(twisty.line, twisty.lengthM / 2), from, to) <= MOUNTAIN_CORRIDOR_KM)
    .reduce((sum, twisty) => sum + twisty.lengthM / 1000, 0)
}

export const splitOf = (key: string): 'tuning' | 'holdout' => (fnv1a(key) % 100 < HOLDOUT_PERCENT ? 'holdout' : 'tuning')
const cellOf = ([lon, lat]: LonLat) => `cell:${Math.floor(lon)}:${Math.floor(lat)}`

/** A road held out of tuning only counts on holdout trips, so the trips made for it are holdout too. */
export const greatTripSet = (road: KnownRoad, tunedThrough: string | null, splitKey: string): 'tuning' | 'holdout' =>
  isHoldoutRoad(road, tunedThrough) ? 'holdout' : splitOf(splitKey)

/** Appends the trips the roads and the mountains call for to `trips.json`; ids already there are left alone. */
export function generate(dataDir: string, known: KnownRoadContext): number {
  const file = resolve('bench/trips.json')
  const existing = JSON.parse(readFileSync(file, 'utf8')) as TripsFile
  const have = new Set([...existing.trips.map((trip) => trip.id), ...(existing.retired ?? []).map((trip) => trip.id)])
  const bytes = readFileSync(join(dataDir, 'graph.bin'))
  const graph: Graph = parseGraph(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  const locator = new NodeLocator(graph)
  const reachable = reachability(graph, locator)
  const placesText = readFileSync(join(dataDir, 'places.json'), 'utf8')
  const twistiesText = readFileSync(twistiesFile(), 'utf8')
  const pool = (JSON.parse(placesText).places as Place[]).filter((place) => PLACE_KINDS.has(place[1]))
  const twisties = parseTwisties(JSON.parse(twistiesText))
  const added: GeneratedTrip[] = []
  const add = (trip: GeneratedTrip) => {
    if (have.has(trip.id)) return
    have.add(trip.id)
    added.push(trip)
  }
  const make = (id: string, kind: string, from: Place, to: Place, extra: Partial<GeneratedTrip>, road?: KnownRoad): GeneratedTrip => {
    const splitKey = cellOf([from[2], from[3]])
    return { id, kind, ...extra, splitKey, set: road ? greatTripSet(road, known.tunedThrough, splitKey) : splitOf(splitKey), from: [from[2], from[3]], fromName: from[0], to: [to[2], to[3]], toName: to[0], includeTracks: false } as GeneratedTrip
  }
  const nearestPlace = (point: LonLat) => pool.reduce((best, place) => (haversineM(point, [place[2], place[3]]) < haversineM(point, [best[2], best[3]]) ? place : best))
  const connected = (from: Place, to: Place) => reachable([from[2], from[3]], [to[2], to[3]])

  for (const { road, located } of known.roads) {
    if (located.deadEnd) continue
    const trips = [...existing.trips, ...added]
    const near = (a: LonLat, b: LonLat) => haversineM(a, b) <= REUSE_WITHIN_M
    if (road.trip) {
      const same = trips.find((trip) => near(trip.from, road.trip!.from) && near(trip.to, road.trip!.to))
      if (same) same.roads = [...new Set([...(same.roads ?? []), road.id])]
      else {
        const splitKey = cellOf(road.trip.from)
        add({ id: `great-${road.id}`, kind: 'great', roads: [road.id], splitKey, set: greatTripSet(road, known.tunedThrough, splitKey), ...road.trip, includeTracks: false })
      }
    }
    const id = `great-${road.id}-ends`
    if (have.has(id)) continue
    const random = mulberry32(fnv1a(`${SEED}:${id}`))
    const middle = pointAlong(located.line, located.lengthM / 2)
    const [first, last] = [located.line[0], located.line[located.line.length - 1]]
    const beyond = (end: LonLat) => {
      const bearing = bearingDeg(middle, end) - GREAT_BEARING_SPREAD_DEG / 2 + random() * GREAT_BEARING_SPREAD_DEG
      return nearestPlace(destination(end, bearing, GREAT_BEYOND_KM[0] + random() * (GREAT_BEYOND_KM[1] - GREAT_BEYOND_KM[0])))
    }
    for (let tries = 0; ; tries++) {
      if (tries > MAX_TRIES) throw new Error(`No trip found around ${road.id}`)
      const [from, to] = [beyond(first), beyond(last)]
      if (from === to || !connected(from, to)) continue
      add(make(id, 'great', from, to, { roads: [road.id], note: `A and B beyond the two ends of ${road.id}` }, road))
      break
    }
  }

  const cells = new Map<string, Place[]>()
  for (const place of pool) cells.set(cellOf([place[2], place[3]]), [...(cells.get(cellOf([place[2], place[3]])) ?? []), place])
  const cellList = [...cells.values()]
  for (let n = 1; n <= MOUNTAIN_TRIPS; n++) {
    const id = `regional-${String(n).padStart(3, '0')}`
    if (have.has(id)) continue
    const random = mulberry32(fnv1a(`${SEED}:${id}`))
    for (let tries = 0; ; tries++) {
      if (tries > MAX_TRIES) throw new Error(`No mountain trip found for ${id}`)
      const cell = cellList[Math.floor(random() * cellList.length)]
      const from = cell[Math.floor(random() * cell.length)]
      const candidates = pool.filter((place) => {
        const km = haversineM([from[2], from[3]], [place[2], place[3]]) / 1000
        return km >= REGIONAL_KM[0] && km <= REGIONAL_KM[1]
      })
      if (candidates.length === 0) continue
      const to = candidates[Math.floor(random() * candidates.length)]
      if (mountainKm(twisties, [from[2], from[3]], [to[2], to[3]]) < MOUNTAIN_TWISTY_KM || !connected(from, to)) continue
      add(make(id, 'regional', from, to, { tags: ['mountain'] }))
      break
    }
  }

  const trips = [...existing.trips, ...added]
  const header = { seed: SEED, ...(existing.retired ? { retired: existing.retired } : {}), generatedOn: { dataHash: dataHash(dataDir), placesHash: sha(placesText), twistiesHash: sha(twistiesText) } }
  writeFileSync(file, `{ ${JSON.stringify(header).slice(1, -1)}, "trips": [\n${trips.map((trip) => JSON.stringify(trip)).join(',\n')}\n] }\n`)
  console.log(`${added.length} trips added, ${trips.length} in all`)
  return 0
}

/** Whether both ends of a trip snap to the road graph and the fastest route between them exists. */
function reachability(graph: Graph, locator: NodeLocator): (from: LonLat, to: LonLat) => boolean {
  const [forward, backward] = [new ShortestPaths(graph), new ShortestPaths(graph, 'backward')]
  const weights = new EdgeWeights(graph).use(0, false)
  return (from, to) => {
    const [start, end] = [locator.nearest(from), locator.nearest(to)]
    return start >= 0 && end >= 0 && bidirectionalEdges(forward, backward, start, end, weights) !== null
  }
}
