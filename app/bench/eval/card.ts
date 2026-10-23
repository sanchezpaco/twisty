import { type Graph, RoadClass } from '../../src/lib/data/graph'
import type { RideOption } from '../../src/lib/routing/ride'
import { labelParts } from '../roads'

/** A ride is "high" where the 5 km around it hold at least this share of fun: the head-to-head study's windows. */
export const WINDOW_HALF_M = 2_500
export const HIGH_FUN_SHARES = [0.8, 0.92] as const
/** `ratedKm` counts the stretches the app rates at least this well. */
export const RATED_MIN = 4
/** A run of one road shorter than this is listed as local roads, not as a road. */
export const MINOR_RUN_M = 1_000
/** Local roads between two runs of the same road, at most this long, belong to that road. */
export const ABSORBED_MAX_M = 2_000
export const LOCAL_ROADS = 'local roads'
export const UNNAMED_ROAD = 'unnamed road'

export interface RoadRun {
  road: string
  km: number
}

/** A route as the judge reads it: the same figures and the same list of roads for every route, whoever made it. */
export interface RouteCard {
  extraMin: number
  km: number
  funKm: number
  km80: number
  km92: number
  motorwayKm: number
  unsafeKm: number
  twistyKm: number
  ratedKm: number
  roads: RoadRun[]
}

export const km = (metres: number) => Math.round(metres / 100) / 10

export function routeCard(graph: Graph, option: RideOption): RouteCard {
  const { edges } = option
  const [km80, km92] = HIGH_FUN_SHARES.map((share) => metresInFunWindows(graph, edges, share))
  return {
    extraMin: Math.round(option.extraS / 6) / 10,
    km: km(option.distanceM),
    funKm: km(option.curvyM),
    km80: km(km80),
    km92: km(km92),
    motorwayKm: km(option.motorwayM),
    unsafeKm: km(unsafeM(graph, edges)),
    twistyKm: km(option.twistyM),
    ratedKm: km(option.twisties.filter((twisty) => twisty.rating >= RATED_MIN).reduce((sum, twisty) => sum + twisty.lengthM, 0)),
    roads: roadRuns(graph, edges),
  }
}

/** Metres of unsafe road, as the head-to-head study counted it: a track, a posted limit of 40 or less, or a ford. */
export function unsafeM(graph: Graph, edges: number[]): number {
  return edges
    .filter((edge) => graph.edgeClass[edge] === RoadClass.Track || graph.edgePostedKmh[edge] > 0 || graph.edgeFords[edge] > 0)
    .reduce((sum, edge) => sum + graph.edgeLengthM[edge], 0)
}

/** Metres of edges ridden more than once: what a route walks again to reach a road. */
export function repeatedM(graph: Graph, edges: number[]): number {
  const seen = new Set<number>()
  return edges.reduce((sum, edge) => (seen.has(edge) ? sum + graph.edgeLengthM[edge] : (seen.add(edge), sum)), 0)
}

/** Metres of the ride whose surrounding window holds a fun share of at least `share`. */
export function metresInFunWindows(graph: Graph, edges: number[], share: number): number {
  const lengthBefore = [0]
  const funBefore = [0]
  for (const edge of edges) {
    lengthBefore.push(lengthBefore[lengthBefore.length - 1] + graph.edgeLengthM[edge])
    funBefore.push(funBefore[funBefore.length - 1] + graph.edgeFunM[edge])
  }
  let [low, high, inside] = [0, 0, 0]
  edges.forEach((edge, index) => {
    const middle = (lengthBefore[index] + lengthBefore[index + 1]) / 2
    while (low < edges.length && lengthBefore[low + 1] < middle - WINDOW_HALF_M) low++
    while (high < edges.length && lengthBefore[high] < middle + WINDOW_HALF_M) high++
    const windowM = lengthBefore[high] - lengthBefore[low]
    if (windowM > 0 && (funBefore[high] - funBefore[low]) / windowM >= share) inside += graph.edgeLengthM[edge]
  })
  return inside
}

interface Run {
  key: string
  metres: number
  /** Metres under each label of the road, to show the commonest one. */
  labels: Map<string, number>
}

const keyOf = (label: string): string => (label ? (labelParts(label).ref ?? label) : UNNAMED_ROAD)

/** The roads of a ride in riding order: edges of one road make a run, short runs fold into local roads. */
export function roadRuns(graph: Graph, edges: number[]): RoadRun[] {
  const runs: Run[] = []
  for (const edge of edges) {
    const label = graph.roadNames[graph.edgeRoad[edge]]
    const [key, metres] = [keyOf(label), graph.edgeLengthM[edge]]
    const last = runs[runs.length - 1]
    const run = last?.key === key ? last : { key, metres: 0, labels: new Map<string, number>() }
    if (run !== last) runs.push(run)
    run.metres += metres
    run.labels.set(label, (run.labels.get(label) ?? 0) + metres)
  }
  const folded: Run[] = []
  for (const run of runs) {
    const minor = run.metres < MINOR_RUN_M
    const next: Run = minor ? { key: LOCAL_ROADS, metres: run.metres, labels: new Map() } : run
    const last = folded[folded.length - 1]
    if (last?.key === next.key) {
      last.metres += next.metres
      for (const [label, metres] of next.labels) last.labels.set(label, (last.labels.get(label) ?? 0) + metres)
    } else folded.push(next)
    absorbLocalRoads(folded)
  }
  return folded.map((run) => ({ road: displayName(run), km: km(run.metres) }))
}

/** `[road, local roads, same road]` becomes one road when the local roads are short. */
function absorbLocalRoads(runs: Run[]): void {
  const [before, between, after] = runs.slice(-3)
  if (after === undefined || between.key !== LOCAL_ROADS || before.key !== after.key || between.metres > ABSORBED_MAX_M) return
  before.metres += between.metres + after.metres
  for (const [label, metres] of after.labels) before.labels.set(label, (before.labels.get(label) ?? 0) + metres)
  runs.splice(-2, 2)
}

function displayName(run: Run): string {
  if (run.key === LOCAL_ROADS || run.key === UNNAMED_ROAD) return run.key
  return [...run.labels].sort((a, b) => b[1] - a[1])[0][0]
}
