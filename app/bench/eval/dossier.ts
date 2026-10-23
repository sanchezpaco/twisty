import type { LonLat } from '../../src/lib/geo'
import type { RideOption } from '../../src/lib/routing/ride'
import { DEFAULT_EXTRA_S } from '../planTrip'
import { isRidden, type LocatedRoad, PolylineIndex } from '../roads'
import type { RouteCard } from './card'
import { type FrozenTrip, hash32, ranked } from './frozen'

export interface TripFacts {
  name: string
  from: LonLat
  to: LonLat
  fastestMin: number
  fastestKm: number
}

/** What the judge reads of a pair: two routes of the same trip, labelled X and Y in an order the key keeps. */
export interface PairItem {
  id: string
  trip: TripFacts
  x: RouteCard
  y: RouteCard
}

export type PairList = 'miss' | 'control' | 'added'

/** What the judge must not read: which route is ours, why the pair is on the list and what it is for. */
export interface PairKey {
  id: string
  list: PairList
  trip: string
  road: string
  /** Extra minutes of the cheapest route that rides the whole road: what the bench demands. */
  forcedCostMin: number
  /** Which of the two is the forced route; the other is our stop. */
  x: 'ours' | 'forced'
  stop: number
  stopExtraMin: number
  /** Whether our stop rides at least `RIDDEN_SHARE` of the road. */
  ours: { rides: boolean }
  /** The road itself: its length and the unsafe km on it, to tell a road that is poor from a route that is. */
  roadKm: number
  roadUnsafeKm: number
  /** Km the forced route walks twice: it backtracks to ride the road. */
  forcedRepeatedKm: number
}

export interface SampleItem {
  id: string
  trip: TripFacts
  route: RouteCard
}

export interface SampleKey {
  id: string
  trip: string
  /** The slots this route fills: the default stop, the stop with the most fun, or both when they are the same route. */
  slots: ('default' | 'fun')[]
  stop: number
}

/** The stop whose extra minutes are closest to `costS`; the cheaper one when two are as close. */
export function stopNearestCost(options: Pick<RideOption, 'extraS'>[], costS: number): number {
  let best = 0
  options.forEach((option, index) => {
    const [distance, bestDistance] = [Math.abs(option.extraS - costS), Math.abs(options[best].extraS - costS)]
    if (distance < bestDistance || (distance === bestDistance && option.extraS < options[best].extraS)) best = index
  })
  return best
}

export const ridesRoad = (option: RideOption, road: LocatedRoad): boolean =>
  isRidden(new PolylineIndex(option.segments.map((segment) => segment.line)), road.line)

/** The stop the app selects first and the one with the most fun; an equal count of fun goes to the cheaper stop. */
export function sampleStops(options: Pick<RideOption, 'extraS' | 'curvyM'>[]): { default: number; fun: number } {
  const fun = options.reduce((best, option, index) => (option.curvyM > options[best].curvyM ? index : best), 0)
  return { default: Math.max(0, options.findLastIndex((option) => option.extraS <= DEFAULT_EXTRA_S)), fun }
}

/** A route of a trip planned on one data folder (a version), for the out-of-sample dossier. */
export interface VersionRoute {
  version: number
  slots: ('default' | 'fun')[]
  stop: number
  edges: number[]
}

/** The distinct routes among the versions' routes of one trip: a route two versions share is judged once, so the
 * judge cannot tell from a repeated card which routes did not change. */
export function distinctRoutes(routes: VersionRoute[]): { edges: number[]; versions: Omit<VersionRoute, 'edges'>[] }[] {
  const byEdges = new Map<string, { edges: number[]; versions: Omit<VersionRoute, 'edges'>[] }>()
  for (const { edges, ...version } of routes) {
    const key = edges.join(',')
    const entry = byEdges.get(key) ?? { edges, versions: [] }
    entry.versions.push(version)
    byEdges.set(key, entry)
  }
  return [...byEdges.values()]
}

/** Whether a pair shows our stop as X: a fixed draw for the pair, so it does not move when other pairs come or go. */
export const oursIsX = (id: string, seed: number): boolean => hash32(`${seed}:flip:${id}`) % 2 === 0

export function tripFacts(trip: FrozenTrip, fastest: RideOption): TripFacts {
  return { name: trip.name, from: trip.from, to: trip.to, fastestMin: Math.round(fastest.timeS / 60), fastestKm: Math.round(fastest.distanceM / 1000) }
}

export function shuffled<T extends { id: string }>(items: T[], seed: number): T[] {
  return ranked(items, 'order', (item) => item.id, seed)
}

const place = ([lon, lat]: LonLat) => `${lat.toFixed(3)}, ${lon.toFixed(3)}`
const FIGURES: [string, (card: RouteCard) => string][] = [
  ['extra minutes over the fastest route', (card) => `${card.extraMin}`],
  ['km', (card) => `${card.km}`],
  ['fun km (curve-weighted)', (card) => `${card.funKm}`],
  ['km where the 5 km around hold ≥ 80 % fun', (card) => `${card.km80}`],
  ['km where the 5 km around hold ≥ 92 % fun', (card) => `${card.km92}`],
  ['km on twisty stretches', (card) => `${card.twistyKm}`],
  ['km on stretches rated 4 or 5 of 5', (card) => `${card.ratedKm}`],
  ['motorway and trunk km', (card) => `${card.motorwayKm}`],
  ['unsafe km (tracks, posted ≤ 40, fords)', (card) => `${card.unsafeKm}`],
]

const roadList = (card: RouteCard) => card.roads.map((run) => `${run.road} ${run.km} km`).join(' › ')
const tripLine = (trip: TripFacts) => `**${trip.name}** · A ${place(trip.from)} · B ${place(trip.to)} · fastest route ${trip.fastestMin} min, ${trip.fastestKm} km`

export function renderPairs(items: PairItem[], preface: string): string {
  const sections = items.map(({ id, trip, x, y }) => {
    const rows = FIGURES.map(([label, value]) => `| ${label} | ${value(x)} | ${value(y)} |`)
    return [`## ${id}`, '', tripLine(trip), '', '| | Route X | Route Y |', '|---|---|---|', ...rows, '', `**X, roads in order:** ${roadList(x)}`, '', `**Y, roads in order:** ${roadList(y)}`, ''].join('\n')
  })
  return [preface, ...sections].join('\n')
}

export function renderSample(items: SampleItem[], preface: string): string {
  const sections = items.map(({ id, trip, route }) => {
    const rows = FIGURES.map(([label, value]) => `| ${label} | ${value(route)} |`)
    return [`## ${id}`, '', tripLine(trip), '', '| | Route |', '|---|---|', ...rows, '', `**Roads in order:** ${roadList(route)}`, ''].join('\n')
  })
  return [preface, ...sections].join('\n')
}
