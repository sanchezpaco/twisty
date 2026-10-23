import { canRide, type Graph, otherEnd, RoadClass } from '../src/lib/data/graph'

// The bench measures twisties with its own frozen copy of the definition, so that changing what the app shows as a
// twisty (`ride.ts`) never changes what the bench has been measuring.
const MEASURE_CURVY_EDGE_SHARE = 0.4
const MEASURE_TWISTY_GAP_M = 1_000
const MEASURE_MIN_TWISTY_M = 3_000

/** Metres of the ride in long curvy stretches of tarmac, closing gaps of dull road up to `MEASURE_TWISTY_GAP_M`. */
export function benchTwistyM(graph: Graph, edges: number[]): number {
  const runs: { fromIndex: number; toIndex: number }[] = []
  let gapM = Infinity
  edges.forEach((edge, index) => {
    const lengthM = graph.edgeLengthM[edge]
    if (!isCurvyEdge(graph, edge)) {
      gapM += lengthM
      return
    }
    const last = runs[runs.length - 1]
    if (last && gapM <= MEASURE_TWISTY_GAP_M) last.toIndex = index
    else runs.push({ fromIndex: index, toIndex: index })
    gapM = 0
  })
  return runs
    .map(({ fromIndex, toIndex }) => lengthM(graph, edges.slice(fromIndex, toIndex + 1)))
    .filter((length) => length >= MEASURE_MIN_TWISTY_M)
    .reduce((sum, length) => sum + length, 0)
}

/** Whether an edge of tarmac is curvy enough to belong to a twisty. */
export function isCurvyEdge(graph: Graph, edge: number): boolean {
  return graph.edgeClass[edge] !== RoadClass.Track && graph.edgeFunM[edge] >= MEASURE_CURVY_EDGE_SHARE * graph.edgeLengthM[edge]
}

function lengthM(graph: Graph, edges: number[]): number {
  return edges.reduce((sum, edge) => sum + graph.edgeLengthM[edge], 0)
}

/** H7: why the edges are not one walk from `start` to `end`, or null when they are. */
export function walkProblem(graph: Graph, edges: number[], start: number, end: number): string | null {
  let node = start
  for (const [index, edge] of edges.entries()) {
    if (graph.edgeFrom[edge] !== node && graph.edgeTo[edge] !== node) return `edge ${index} (${edge}) does not touch node ${node}`
    node = otherEnd(graph, edge, node)
  }
  return node === end ? null : `the walk ends at node ${node}, not at ${end}`
}

/** H13: metres of the ride against the direction of one-way edges. */
export function wrongWayM(graph: Graph, edges: number[], start: number): number {
  let [node, metres] = [start, 0]
  for (const edge of edges) {
    if (!canRide(graph, edge, node)) metres += graph.edgeLengthM[edge]
    node = otherEnd(graph, edge, node)
  }
  return metres
}

/** H8: edges of the ride that are unpaved roads or tracks. */
export function trackEdgeCount(graph: Graph, edges: number[]): number {
  return edges.filter((edge) => graph.edgeClass[edge] === RoadClass.Track).length
}

// Thresholds of the route sanity checks (R1-R14). All of them only report for now: a check is promoted to a ratchet
// when it has caught a problem a human confirmed.
// No edge is ridden twice: the planner refuses a ride that does, so a repeat is a defect, however short.
export const BACKTRACK_MAX_M = 0
export const FASTEST_DETOUR_MAX = 1.8
export const TRANSIT_PER_TWISTY_MAX = 3
export const FASTEST_KMH_RANGE: [number, number] = [45, 110]
/** R5 only judges trips at least this far apart in a straight line. */
export const FASTEST_SPEED_MIN_TRIP_KM = 100
export const SLOW_DULL_EXTRA_MAX_M = 8_000
export const TOWNS_CROSSED_MAX = 5
/** R6b counts places this close to the route. */
export const TOWN_NEAR_M = 2_000
export const THIN_STOP_MIN_TWISTY_M = 2_000
export const THIN_STOP_MAX_MIN_PER_TWISTY_KM = 5
export const SUSPICIOUS_MAX_M = 1_000
export const TIME_ERROR_MAX = 0.15
export const REGRESS_PER_TWISTY_KM_MAX = 1
export const PIN_FIDELITY_MIN = 0.9
export const STRAIGHT_IN_TWISTY_MAX_M = 5_000
/** R16: a city's centre is the ground within this distance of its place... */
export const CITY_CENTRE_RADIUS_M = 3_000
/** ...a city this close to either end of the trip is not avoidable, and... */
export const CITY_ENDS_M = 6_000
/** ...a stop is flagged when it rides this many km more of it than the fastest route, on roads that are not fast. */
export const CITY_CENTRE_EXTRA_KM = 1
/** R17: a side loop leaves the ride and meets it again within this time of the fastest way between the two... */
export const LOOP_CHORD_MAX_S = 20 * 60
/** ...and takes at least this much longer than that way. */
export const LOOP_WASTE_MIN_S = 5 * 60
/** R17b: a loop that buys less than this many fun km per minute it adds, over what the fastest way has, is low return. */
export const LOOP_LOW_RETURN_KM_PER_MIN = 0.5
/** R18: a turn from one road onto another that doubles back at least this much (180 is a U-turn). */
export const SHARP_TURN_DEG = 150
/** R9 judges trips at least this far apart. */
export const EMPTY_SLIDER_MIN_TRIP_KM = 50
export const EMPTY_SLIDER_MAX_STOPS = 2

/** The raw numbers of the sanity checks for one trip, per slider stop unless said otherwise. */
export interface TripChecks {
  /** R1 */
  backtrackM: number[]
  /** R2 */
  revisited: number[]
  /** R3, the whole trip */
  fastestDetour: number
  /** R4: non-twisty km gained per twisty km gained over the fastest option; null for the fastest, Infinity when no twisty km are gained */
  transitPerTwistyKm: (number | null)[]
  /** R5, the whole trip: null under 100 km */
  fastestKmh: number | null
  /** R6 over the fastest option */
  slowDullExtraM: number[]
  /** R6b: places within 2 km that the fastest option does not pass */
  townsExtra: number[]
  /** R7: the step from the previous stop buys little */
  thinStop: boolean[]
  /** R8: no road the previous stop did not have */
  sameRoads: boolean[]
  /** R10 */
  suspiciousM: number[]
  /** R11, the whole trip, when the trip has a reference time */
  timeError: number | null
  /** R12: regress km over the fastest option's, per twisty km gained */
  regressPerTwistyKm: (number | null)[]
  /** R13 by stop, for the default stop and the one with most curves */
  pinFidelity: Record<number, number | null>
  /** R14: the longest run of dull road inside a twisty the app shows */
  straightInTwistyM: number[]
  /** R16, by stop: km of road that is not fast inside a city's centre, by city (cities with none are left out) */
  cityCentreKm: Record<string, number>[]
  /** R17, by stop: the side loops of `LOOP_WASTE_MIN_S` or more */
  sideLoops: SideLoop[][]
  /** R18, by stop: turns of `SHARP_TURN_DEG` or more from one road onto another */
  sharpTurns: number[]
  /** R19, by stop: metres of a town's one-way streets ridden against their direction (the graph rides them both ways) */
  townWrongWayM: number[]
  /** R20, by stop: Google Maps waypoints on such a stretch, which would send Google the wrong way down the street */
  townWrongWaypoints: number[]
}

/** `[minutes added over the fastest way between its ends, fun km it has over that way, the road it rides most]` */
export type SideLoop = [number, number, string]

export interface Violation {
  check: string
  /** Stop index, or null for a check on the whole trip. */
  stop: number | null
}

/** The most km a stop rides in one city's centre beyond what the fastest route rides there. */
function extraCityKm(stop: Record<string, number> | undefined, fastest: Record<string, number> | undefined): number {
  return Math.max(0, ...Object.entries(stop ?? {}).map(([city, km]) => km - (fastest?.[city] ?? 0)))
}

/** Which checks a trip's numbers break. `expectsMore`: the trip has a demanded great road or is a mountain trip (R9). */
export function violations(checks: TripChecks, optionCount: number, tripKm: number, expectsMore: boolean): Violation[] {
  const found: Violation[] = []
  const perStop = (check: string, flagged: (index: number) => boolean) =>
    checks.backtrackM.forEach((_, index) => flagged(index) && found.push({ check, stop: index }))
  perStop('R1 backtrackM', (i) => checks.backtrackM[i] > BACKTRACK_MAX_M)
  perStop('R2 loops', (i) => checks.revisited[i] > 0)
  perStop('R4 transitPerTwisty', (i) => (checks.transitPerTwistyKm[i] ?? 0) > TRANSIT_PER_TWISTY_MAX)
  perStop('R6 slowDullExtra', (i) => checks.slowDullExtraM[i] > SLOW_DULL_EXTRA_MAX_M)
  perStop('R6b townsCrossed', (i) => checks.townsExtra[i] > TOWNS_CROSSED_MAX)
  perStop('R7 thinStops', (i) => checks.thinStop[i])
  perStop('R8 sameRoads', (i) => checks.sameRoads[i])
  perStop('R10 suspiciousNames', (i) => checks.suspiciousM[i] >= SUSPICIOUS_MAX_M)
  perStop('R12 regressKm', (i) => (checks.regressPerTwistyKm[i] ?? 0) > REGRESS_PER_TWISTY_KM_MAX)
  perStop('R14 straightInTwisty', (i) => checks.straightInTwistyM[i] > STRAIGHT_IN_TWISTY_MAX_M)
  for (const [stop, share] of Object.entries(checks.pinFidelity)) {
    if (share !== null && share < PIN_FIDELITY_MIN) found.push({ check: 'R13 pinFidelity', stop: Number(stop) })
  }
  perStop('R16 cityCentre', (i) => extraCityKm(checks.cityCentreKm?.[i], checks.cityCentreKm?.[0]) >= CITY_CENTRE_EXTRA_KM)
  perStop('R17 dominatedLoop', (i) => (checks.sideLoops?.[i] ?? []).some(([, funKm]) => funKm <= 0))
  perStop('R17b lowReturnLoop', (i) => (checks.sideLoops?.[i] ?? []).some(([minutes, funKm]) => funKm / minutes < LOOP_LOW_RETURN_KM_PER_MIN))
  perStop('R18 sharpTurn', (i) => (checks.sharpTurns?.[i] ?? 0) > 0)
  perStop('R19 townWrongWay', (i) => (checks.townWrongWayM?.[i] ?? 0) > 0)
  perStop('R20 townWrongWaypoint', (i) => (checks.townWrongWaypoints?.[i] ?? 0) > 0)
  if (checks.fastestDetour > FASTEST_DETOUR_MAX) found.push({ check: 'R3 fastestDetour', stop: null })
  if (checks.fastestKmh !== null && (checks.fastestKmh < FASTEST_KMH_RANGE[0] || checks.fastestKmh > FASTEST_KMH_RANGE[1])) found.push({ check: 'R5 fastestSpeed', stop: null })
  if (checks.timeError !== null && checks.timeError > TIME_ERROR_MAX) found.push({ check: 'R11 timeError', stop: null })
  if (tripKm >= EMPTY_SLIDER_MIN_TRIP_KM && optionCount <= EMPTY_SLIDER_MAX_STOPS && expectsMore) found.push({ check: 'R9 emptySlider', stop: null })
  return found
}
