import type { NodeLocator } from '../src/lib/routing/nodeLocator'
import type { Planner } from '../src/lib/routing/planner'
import { badRoadsRidden } from './badRoads'
import { trackEdgeCount, walkProblem, wrongWayM } from './checks'
import { carriagewayUTurns } from './metrics'
import { candidateRoads, greatRoadResults, type KnownRoadContext } from './greatRoads'
import type { ModelRecall } from './modelRecall'
import { optionRecord, type TripResult } from './results'
import { type LocatedRoad, PolylineIndex } from './roads'
import { type CheckTools, tripChecks } from './tripChecks'
import type { BenchTrip } from './trips'

/** The stop the app selects first: the last one within this extra time. Keep in sync with `App.svelte`. */
export const DEFAULT_EXTRA_S = 45 * 60

/** The known roads, and how to cost a detour through them on the graph the trip is planned on. */
export interface GreatRoadTools {
  context: KnownRoadContext
  detourCosts: (trip: { start: number; end: number; includeTracks: boolean }, roads: LocatedRoad[]) => Map<string, number>
}

/** What the bench adds to a plan; each part is left out when it is not given. */
export interface TripTools extends CheckTools {
  great?: GreatRoadTools
  /** Roads rider-safety lists as unsafe, located in the graph (H11). */
  bad?: LocatedRoad[]
  recall?: ModelRecall
}

/** Plans a trip with the real planner and runs the checks that need the graph. */
export function planTrip(
  planner: Pick<Planner, 'graph' | 'plan' | 'settledNodes'>,
  locator: NodeLocator,
  trip: BenchTrip,
  tools: TripTools = {},
): TripResult {
  const { graph } = planner
  const settledBefore = planner.settledNodes
  const started = performance.now()
  let options
  try {
    options = planner.plan([trip.from, trip.to], { includeTracks: trip.includeTracks })
  } catch (error) {
    const reason = error instanceof Error ? `${error.name} ${error.message}` : String(error)
    return { id: trip.id, ms: performance.now() - started, settled: 0, defaultStop: -1, options: [], greatRoads: {}, checks: null, missedTwisties: [], failures: [`H1 plans: ${reason}`] }
  }
  const ms = performance.now() - started
  const [start, end] = [locator.nearest(trip.from), locator.nearest(trip.to)]
  const failures: string[] = []
  const lines = options.map((option) => new PolylineIndex(option.segments.map((segment) => segment.line)))
  options.forEach((option, index) => {
    const problem = walkProblem(graph, option.edges, start, end)
    if (problem) failures.push(`H7 connected: stop ${index}: ${problem}`)
    const tracks = trackEdgeCount(graph, option.edges)
    if (!trip.includeTracks && (tracks > 0 || option.trackM > 0)) failures.push(`H8 noTracksWhenOff: stop ${index} rides ${tracks} track edges`)
    const wrongWay = wrongWayM(graph, option.edges, start)
    if (wrongWay > 0) failures.push(`H13 oneWay: stop ${index} rides ${Math.round(wrongWay)} m against one-way edges`)
    const uTurns = carriagewayUTurns(graph, option.edges, start)
    if (uTurns > 0) failures.push(`H14 noCarriagewayUTurn: stop ${index} turns back from one carriageway onto the other ${uTurns} times`)
    for (const { id, riddenM } of badRoadsRidden(lines[index], tools.bad ?? [])) failures.push(`H11 noBadRoads: stop ${index} rides ${Math.round(riddenM)} m of ${id}`)
  })
  const { great } = tools
  const candidates = great ? candidateRoads(great.context, trip.from, trip.to) : []
  const costs = great ? great.detourCosts({ start, end, includeTracks: trip.includeTracks }, candidates) : new Map<string, number>()
  const records = options.map((option) => optionRecord(graph, option))
  const defaultStop = Math.max(0, options.findLastIndex((option) => option.extraS <= DEFAULT_EXTRA_S))
  return {
    id: trip.id,
    ms,
    settled: planner.settledNodes - settledBefore,
    defaultStop,
    options: records,
    greatRoads: great ? greatRoadResults(great.context, trip, options, lines, costs) : {},
    checks: options.length > 0 ? tripChecks(graph, trip, options, records, start, [defaultStop, options.length - 1], tools) : null,
    missedTwisties: tools.recall?.missed(trip, start, end, lines) ?? [],
    failures,
  }
}
