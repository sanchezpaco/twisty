import { createHash } from 'node:crypto'
import type { RideOption } from '../src/lib/routing/ride'
import { MAX_WAYPOINTS } from '../src/lib/googleMaps'
import { benchTwistyM } from './checks'
import type { Graph } from '../src/lib/data/graph'
import type { TripChecks } from './checks'
import type { GreatRoadResult } from './greatRoads'
import type { MissedTwisty } from './modelRecall'

/** An option as the bench keeps it: the numbers its checks and its diff read, and the identity of the route. */
export interface OptionRecord {
  timeS: number
  extraS: number
  distanceM: number
  curvyM: number
  twistyM: number
  benchTwistyM: number
  motorwayM: number
  trackM: number
  otherM: number
  /** `[label, lengthM, rating]` */
  twisties: [string, number, number][]
  /** Waypoints in the Google Maps hand-off. */
  pins: number
  /** Changes only when the route does. Edge ids change with every data build, so it only compares within one data hash. */
  routeId: string
  /**
   * Hashes everything the rider sees but the edge ids, so it holds across builds that only renumber the graph: a
   * different one with the same `routeId` means only the display changed.
   */
  presentation: string
  /** The road a coverage stop was swapped in for, when it was (absent in older results). */
  coverageRoad?: string | null
}

export interface TripResult {
  id: string
  ms: number
  settled: number
  /** Index of the stop the app selects first, or -1 without options. */
  defaultStop: number
  options: OptionRecord[]
  /** The known roads this trip passes near enough to matter, by road id. */
  greatRoads: Record<string, GreatRoadResult>
  /** The numbers of the route sanity checks (R1-R13); null when the trip did not plan. */
  checks: TripChecks | null
  /** G6: well-rated roads of the overlay within 30 minutes of detour that no stop rides. */
  missedTwisties: MissedTwisty[]
  /** What failed, as `<check>: <what>`. */
  failures: string[]
}

const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16)

export function routeId(option: RideOption): string {
  return hash(`${option.edges.join(',')}|${option.timeS}|${option.distanceM}|${option.curvyM}`)
}

export function pinCount(googleMapsUrl: string): number {
  const waypoints = new URL(googleMapsUrl).searchParams.get('waypoints')
  return waypoints ? Math.min(waypoints.split('|').length, MAX_WAYPOINTS) : 0
}

export function optionRecord(graph: Graph, option: RideOption): OptionRecord {
  return {
    timeS: option.timeS,
    extraS: option.extraS,
    distanceM: option.distanceM,
    curvyM: option.curvyM,
    twistyM: option.twistyM,
    benchTwistyM: benchTwistyM(graph, option.edges),
    motorwayM: option.motorwayM,
    trackM: option.trackM,
    otherM: option.otherM,
    twisties: option.twisties.map((twisty) => [twisty.label, twisty.lengthM, twisty.rating]),
    pins: pinCount(option.googleMapsUrl),
    routeId: routeId(option),
    presentation: hash(JSON.stringify({ ...option, edges: undefined })),
    coverageRoad: option.coverageRoad,
  }
}
