import { EdgeFlag, edgeCoordinates, type Graph, nodePosition, OneWay, otherEnd, RoadClass } from '../data/graph'
import { splitRoadLabel } from '../curves'
import type { LonLat } from '../geo'
import { googleMapsDirectionsUrl, MAX_WAYPOINTS, type PinLine, twistyPins } from '../googleMaps'

/** One road of a twisty, and how much of the twisty it is. */
export interface TwistyRoad {
  /** Ref and name, as `RideTwisty.label`. */
  label: string
  lengthM: number
}

/** A curvy stretch of the ride, highlighted on the map and listed in the summary. */
export interface RideTwisty {
  /** Ref and name of its longest named road, e.g. "CV-35 · Carretera València - Ademuz"; empty when no road has one. */
  label: string
  lengthM: number
  /** Its roads in riding order, each with its own km here; absent in rides saved before. */
  roads?: TwistyRoad[]
  /** 1 (flowing) to 5 (epic). */
  rating: number
  /** Metres on narrow ways (a single lane for both directions, or about 3.5 m wide): oncoming traffic in blind bends. */
  narrowM: number
  /** The lowest limit posted on at least `POSTED_MIN_COVER_M` of the twisty, when it is at most 40 km/h. */
  postedKmh: number | null
  /** Ford nodes on the twisty, as mapped: usually dry dips, but a flash flood is another matter. */
  fordCount: number
  /** Some of it closes to motor traffic part of the year; absent in rides saved before it was known. */
  closedPartOfYear?: boolean
  line: LonLat[]
  /** The leg it is ridden in: twisties are split at the rider's stops. */
  leg: number
}

/** The ride between two consecutive points of the trip; the legs add up to the whole ride. */
export interface RideLeg {
  timeS: number
  distanceM: number
  twistyM: number
  curvyM: number
}

export interface RouteSegment {
  kind: 'transit' | 'twisty' | 'track'
  line: LonLat[]
  /** Rating of the twisty, 1 (flowing) to 5 (epic); only on twisty segments. */
  rating?: number
}

export interface RideOption {
  /** The edge ids of the ride in riding order, which identify it and let tests walk it. */
  edges: number[]
  timeS: number
  extraS: number
  distanceM: number
  /** Fun score as a distance: a km of perfect twisty road counts fully, a km of sweepers about half. */
  curvyM: number
  // Real distances that add up to distanceM: each metre is counted once, twisties first.
  twistyM: number
  motorwayM: number
  /** Unpaved roads and tracks, only present when the rider opted in. */
  trackM: number
  otherM: number
  twisties: RideTwisty[]
  segments: RouteSegment[]
  googleMapsUrl: string
  /** Every twisty got its entry and exit pins in `googleMapsUrl`, so Google Maps rides each one end to end. */
  pinnedAll: boolean
  legs: RideLeg[]
  /** The road this option was given so that a great road is not left out of the slider; the summary lists it first. */
  coverageRoad: string | null
  /** The index in `twisties` of the one that rides that road; absent when none does, and in rides saved before it was. */
  coverageTwisty?: number
  /** Ford nodes on the whole ride, twisties or not; absent in rides saved before it was counted. */
  fordCount?: number
  /** Some road of the ride closes to motor traffic part of the year; absent in rides saved before it was known. */
  closedPartOfYear?: boolean
  /** The named roads of the ride that close part of the year, in riding order, for the note to name; absent in rides saved before. */
  closedRoads?: string[]
}

export interface RideContext {
  graph: Graph
  /** The start, the rider's stops in order, the finish. */
  points: LonLat[]
  start: number
  edges: number[]
  /** For each leg, the index after its last edge; one leg when left out. */
  legEnds?: number[]
  fastestS: number
  /** The edges of the road this option was given for, so that a great road is not left out of the slider. */
  addedRoad?: number[]
  /** The start is the rider's own position, which the Google Maps link leaves out. */
  startIsRider?: boolean
}

const FAST_ROAD_CLASSES = new Set<number>([RoadClass.Motorway, RoadClass.Trunk])
// An edge belongs to a highlighted twisty when at least this share of it is fun.
export const CURVY_EDGE_SHARE = 0.4
// Short dull bits (a junction, a bridge) do not break a twisty.
export const MAX_TWISTY_GAP_M = 1_000
export const MIN_TWISTY_LENGTH_M = 3_000
// Two twisties on the same road read as one across a dull stretch no longer than a twisty itself (a village, a
// straight between two passes); across more than that the rider would call them two roads, not one.
const MAX_SAME_ROAD_GAP_M = MIN_TWISTY_LENGTH_M
// Fun share needed for ratings 2..5. Keep in sync with RATING_FUN_THRESHOLDS in pipeline/twisty_pipeline/twisties.py.
const FUN_RATING_THRESHOLDS = [0.45, 0.65, 0.8, 0.92]
// A limit counts as the twisty's when at least this much of it is posted so: a village's 30 does not make a road signed.
const POSTED_MIN_COVER_M = 1_000
// Index of the empty name in Graph.roadNames.
export const UNNAMED = 0
// A twisty lists its roads; a piece of another road shorter than this (a bridge, a junction, a village's street) is told
// as part of the road it interrupts.
const ROAD_PIECE_MIN_M = 1_000

interface Step {
  edge: number
  line: LonLat[]
  /** A one-way street ridden against its way (a town's, see OneWay.InTown): Google Maps would not follow a pin there. */
  againstOneWay: boolean
}

export function buildRideOption({ graph, points, start, edges, legEnds = [edges.length], fastestS, addedRoad, startIsRider = false }: RideContext): RideOption {
  const steps = walk(graph, edges, start)
  // The rider stops between legs, so a twisty ends at a stop and the next leg's starts after it.
  const runs: [number, number][] = []
  const runLegs: number[] = []
  legEnds.forEach((end, leg) => {
    const begin = leg === 0 ? 0 : legEnds[leg - 1]
    for (const [first, last] of twistyStretches(graph, edges.slice(begin, end))) {
      runs.push([begin + first, begin + last])
      runLegs.push(leg)
    }
  })
  const twisties = runs.map(([first, last], i) => ({ ...describeRun(graph, steps, first, last), leg: runLegs[i] }))

  const inTwisty = new Uint8Array(edges.length)
  for (const [first, last] of runs) inTwisty.fill(1, first, last + 1)

  let timeS = 0
  let curvyM = 0
  const distance = { twistyM: 0, motorwayM: 0, trackM: 0, otherM: 0 }
  const legs = legEnds.map(() => ({ timeS: 0, distanceM: 0, twistyM: 0, curvyM: 0 }))
  let leg = 0
  edges.forEach((edge, index) => {
    while (index >= legEnds[leg]) leg++
    const lengthM = graph.edgeLengthM[edge]
    timeS += graph.edgeTimeS[edge]
    curvyM += graph.edgeFunM[edge]
    distance[distanceKind(graph, edge, inTwisty[index] === 1)] += lengthM
    legs[leg].timeS += graph.edgeTimeS[edge]
    legs[leg].distanceM += lengthM
    legs[leg].curvyM += graph.edgeFunM[edge]
    if (inTwisty[index] === 1) legs[leg].twistyM += lengthM
  })
  const distanceM = distance.twistyM + distance.motorwayM + distance.trackM + distance.otherM

  return {
    edges,
    timeS,
    extraS: timeS - fastestS,
    distanceM,
    curvyM,
    ...distance,
    twisties,
    segments: segments(graph, steps, runs, twisties, points[0], points[points.length - 1]),
    ...directions(points, steps, runs, twisties, startIsRider),
    legs,
    fordCount: edges.reduce((sum, edge) => sum + graph.edgeFords[edge], 0),
    closedPartOfYear: closesPartOfYear(graph, edges),
    closedRoads: closedRoads(graph, edges),
    ...(addedRoad ? addedTwisty(graph, edges, runs, twisties, addedRoad) : { coverageRoad: null }),
  }
}

/**
 * The added road as the summary lists it: the option's twisty that rides most of it, which the summary puts first, and
 * its label. The road's own label can differ (its main road is B-124, the twisty's BP-1241 when the twisty goes on along
 * BP-1241), and a label can be two twisties' (a road ridden in two pieces), so the twisty is told by its index; the road's
 * own label is kept only when no twisty rides it.
 */
function addedTwisty(
  graph: Graph,
  edges: number[],
  runs: [number, number][],
  twisties: RideTwisty[],
  addedRoad: number[],
): Pick<RideOption, 'coverageRoad' | 'coverageTwisty'> {
  const added = new Set(addedRoad)
  const riddenM = runs.map(([first, last]) => runLength(graph, edges.slice(first, last + 1).filter((edge) => added.has(edge))))
  const most = riddenM.indexOf(Math.max(...riddenM))
  return most >= 0 && riddenM[most] > 0 ? { coverageRoad: twisties[most].label, coverageTwisty: most } : { coverageRoad: roadLabel(graph, addedRoad) }
}

function walk(graph: Graph, edges: number[], start: number): Step[] {
  let node = start
  const steps = edges.map((edge) => {
    const line = edgeCoordinates(graph, edge, node)
    const againstOneWay = graph.edgeOneway[edge] !== OneWay.No && graph.edgeFrom[edge] !== node
    node = otherEnd(graph, edge, node)
    return { edge, line, againstOneWay }
  })
  steps.push({ edge: -1, line: [nodePosition(graph, node)], againstOneWay: false })
  return steps
}

function distanceKind(graph: Graph, edge: number, inTwisty: boolean): 'twistyM' | 'motorwayM' | 'trackM' | 'otherM' {
  if (inTwisty) return 'twistyM'
  if (isTrack(graph, edge)) return 'trackM'
  return FAST_ROAD_CLASSES.has(graph.edgeClass[edge]) ? 'motorwayM' : 'otherM'
}

export function twistyLengthM(graph: Graph, edges: number[]): number {
  return twistyStretches(graph, edges).reduce((sum, [first, last]) => sum + runLength(graph, edges.slice(first, last + 1)), 0)
}

/** Inclusive [first, last] edge index ranges of the twisties a rider would name on this route. */
export function twistyStretches(graph: Graph, edges: number[]): [number, number][] {
  return mergeSameRoad(graph, edges, twistyRuns(graph, edges))
}

function isTrack(graph: Graph, edge: number): boolean {
  return graph.edgeClass[edge] === RoadClass.Track
}

/** Inclusive [first, last] edge index ranges that form long curvy stretches of tarmac. */
function twistyRuns(graph: Graph, edges: number[]): [number, number][] {
  const runs: [number, number][] = []
  let gapM = Infinity
  edges.forEach((edge, index) => {
    const lengthM = graph.edgeLengthM[edge]
    if (isTrack(graph, edge) || graph.edgeFunM[edge] < CURVY_EDGE_SHARE * lengthM) {
      gapM += lengthM
      return
    }
    if (runs.length > 0 && gapM <= MAX_TWISTY_GAP_M) runs[runs.length - 1][1] = index
    else runs.push([index, index])
    gapM = 0
  })
  return runs.filter(([first, last]) => runLength(graph, edges.slice(first, last + 1)) >= MIN_TWISTY_LENGTH_M)
}

/** Consecutive runs on the same road read as one twisty, even with a short straight bit in between. */
function mergeSameRoad(graph: Graph, edges: number[], runs: [number, number][]): [number, number][] {
  const merged: [number, number][] = []
  for (const run of runs) {
    const previous = merged[merged.length - 1]
    const sameRoad = previous && mainRoad(graph, edges, previous) === mainRoad(graph, edges, run)
    const closeEnough = previous && runLength(graph, edges.slice(previous[1] + 1, run[0])) <= MAX_SAME_ROAD_GAP_M
    if (sameRoad && closeEnough && mainRoad(graph, edges, run) !== UNNAMED) previous[1] = run[1]
    else merged.push([...run])
  }
  return merged
}

function mainRoad(graph: Graph, edges: number[], [first, last]: [number, number]): number {
  const lengthByRoad = new Map<number, number>()
  for (const edge of edges.slice(first, last + 1)) {
    lengthByRoad.set(graph.edgeRoad[edge], (lengthByRoad.get(graph.edgeRoad[edge]) ?? 0) + graph.edgeLengthM[edge])
  }
  return [...lengthByRoad].reduce((a, b) => (b[1] > a[1] ? b : a))[0]
}

function runLength(graph: Graph, edges: number[]): number {
  return edges.reduce((sum, edge) => sum + graph.edgeLengthM[edge], 0)
}

function describeRun(graph: Graph, steps: Step[], first: number, last: number): Omit<RideTwisty, 'leg'> {
  const edges = steps.slice(first, last + 1).map((step) => step.edge)
  const lengthM = runLength(graph, edges)
  const funM = edges.reduce((sum, edge) => sum + graph.edgeFunM[edge], 0)
  const roads = roadsAlong(graph, edges)
  const named = roads.filter(({ label }) => label !== '')
  return {
    label: named.length > 0 ? named.reduce((a, b) => (b.lengthM > a.lengthM ? b : a)).label : '',
    lengthM,
    roads,
    rating: ratingOf(funM / lengthM),
    narrowM: edges.reduce((sum, edge) => sum + (graph.edgeNarrow[edge] / 255) * graph.edgeLengthM[edge], 0),
    postedKmh: lowestPostedKmh(graph, edges),
    fordCount: edges.reduce((sum, edge) => sum + graph.edgeFords[edge], 0),
    closedPartOfYear: closesPartOfYear(graph, edges),
    line: lineOf(steps, first, last),
  }
}

// In a town a closure is a festival's or a market's (València's streets close for the Fallas, 15-19 March): the rider is
// told of the roads that close for a season, not of a town's few days.
const closesForASeason = (graph: Graph, edge: number) => (graph.edgeFlags[edge] & (EdgeFlag.ClosedPartOfYear | EdgeFlag.BuiltUp)) === EdgeFlag.ClosedPartOfYear
const closesPartOfYear = (graph: Graph, edges: number[]) => edges.some((edge) => closesForASeason(graph, edge))

/** Each named road with a seasonal closure on the ride, once, by the label it carries most there. */
function closedRoads(graph: Graph, edges: number[]): string[] {
  const byRoad = new Map<string, Map<string, number>>()
  for (const edge of edges.filter((edge) => closesForASeason(graph, edge))) {
    const label = graph.roadNames[graph.edgeRoad[edge]]
    const key = splitRoadLabel(label).title
    if (key === '') continue
    const labels = byRoad.get(key) ?? byRoad.set(key, new Map()).get(key)!
    labels.set(label, (labels.get(label) ?? 0) + graph.edgeLengthM[edge])
  }
  return [...byRoad.values()].map((labels) => [...labels].reduce((a, b) => (b[1] > a[1] ? b : a))[0])
}

/**
 * The roads along the edges in riding order: pieces of one road (one ref, whatever the street or bridge names it carries)
 * are joined, and short pieces of another road count to the one they interrupt.
 */
function roadsAlong(graph: Graph, edges: number[]): TwistyRoad[] {
  type Piece = { key: string; lengthM: number; byLabel: Map<string, number> }
  const pieces: Piece[] = []
  for (const edge of edges) {
    const label = graph.roadNames[graph.edgeRoad[edge]]
    const key = splitRoadLabel(label).title
    const last = pieces.at(-1)
    if (!last || last.key !== key) pieces.push({ key, lengthM: 0, byLabel: new Map() })
    const piece = pieces.at(-1)!
    piece.lengthM += graph.edgeLengthM[edge]
    piece.byLabel.set(label, (piece.byLabel.get(label) ?? 0) + graph.edgeLengthM[edge])
  }
  const kept: Piece[] = []
  let carriedM = 0
  for (const piece of pieces) {
    const last = kept.at(-1)
    if (piece.lengthM < ROAD_PIECE_MIN_M && pieces.length > 1) {
      if (last) last.lengthM += piece.lengthM
      else carriedM += piece.lengthM
    } else if (last && last.key === piece.key) {
      last.lengthM += piece.lengthM
      piece.byLabel.forEach((lengthM, label) => last.byLabel.set(label, (last.byLabel.get(label) ?? 0) + lengthM))
    } else {
      kept.push({ ...piece, lengthM: piece.lengthM + carriedM })
      carriedM = 0
    }
  }
  if (kept.length === 0) return [{ label: graph.roadNames[mainRoad(graph, edges, [0, edges.length - 1])], lengthM: runLength(graph, edges) }]
  return kept.map(({ lengthM, byLabel }) => ({ label: [...byLabel].reduce((a, b) => (b[1] > a[1] ? b : a))[0], lengthM }))
}

/** 1 to 5 from the share of a road's length that is fun. */
export function ratingOf(funShare: number): number {
  return 1 + FUN_RATING_THRESHOLDS.filter((threshold) => funShare >= threshold).length
}

/** The name of the road most of the edges are on. */
export function roadLabel(graph: Graph, edges: number[]): string {
  return graph.roadNames[mainRoad(graph, edges, [0, edges.length - 1])]
}

function lowestPostedKmh(graph: Graph, edges: number[]): number | null {
  const lengthByLimit = new Map<number, number>()
  for (const edge of edges) {
    const limit = graph.edgePostedKmh[edge]
    if (limit > 0) lengthByLimit.set(limit, (lengthByLimit.get(limit) ?? 0) + graph.edgeLengthM[edge])
  }
  const covering = [...lengthByLimit].filter(([, lengthM]) => lengthM >= POSTED_MIN_COVER_M).map(([limit]) => limit)
  return covering.length > 0 ? Math.min(...covering) : null
}

/** Coordinates of steps first..last; each step's line stops short of its end node, which starts the next step. */
function lineOf(steps: Step[], first: number, last: number): LonLat[] {
  return [...steps.slice(first, last + 1).flatMap((step) => step.line), steps[last + 1].line[0]]
}

function segments(
  graph: Graph,
  steps: Step[],
  runs: [number, number][],
  twisties: RideTwisty[],
  from: LonLat,
  to: LonLat,
): RouteSegment[] {
  const result: RouteSegment[] = []
  const push = (kind: RouteSegment['kind'], first: number, last: number, rating?: number) => {
    if (last >= first) result.push({ kind, line: lineOf(steps, first, last), ...(rating && { rating }) })
  }
  const kindOf = (step: number) => (isTrack(graph, steps[step].edge) ? 'track' : 'transit')
  // Between twisties the ride alternates between tarmac and tracks.
  const pushBetween = (first: number, last: number) => {
    let start = first
    for (let i = first; i <= last; i++) {
      if (i < last && kindOf(i + 1) === kindOf(i)) continue
      push(kindOf(i), start, i)
      start = i + 1
    }
  }
  let cursor = 0
  runs.forEach(([first, last], i) => {
    pushBetween(cursor, first - 1)
    push('twisty', first, last, twisties[i].rating)
    cursor = last + 1
  })
  pushBetween(cursor, steps.length - 2)
  result[0].line.unshift(from)
  result[result.length - 1].line.push(to)
  return result
}

/**
 * Google Maps takes few waypoints: the rider's stops, always, and pins on the most rewarding twisties with what is left,
 * each pinned end to end or not at all, all in riding order.
 */
function directions(points: LonLat[], steps: Step[], runs: [number, number][], twisties: RideTwisty[], startIsRider: boolean): Pick<RideOption, 'googleMapsUrl' | 'pinnedAll'> {
  const stops = points.slice(1, -1)
  const budget = MAX_WAYPOINTS - stops.length
  const reward = (twisty: RideTwisty) => twisty.lengthM * twisty.rating
  const pinned = [...twisties.keys()]
    .sort((a, b) => reward(twisties[b]) - reward(twisties[a]))
    .slice(0, Math.floor(budget / 2))
    .sort((a, b) => a - b)
  const pins = twistyPins(pinned.map((i): PinLine => ({ line: twisties[i].line, keepOut: wrongWayRanges(steps, runs[i]) })), budget)
  const pinsOfLeg = (leg: number) => pinned.flatMap((twisty, i) => (twisties[twisty].leg === leg ? pins[i].pins : []))
  const waypoints = [...stops.flatMap((stop, leg) => [...pinsOfLeg(leg), stop]), ...pinsOfLeg(stops.length)]
  return {
    googleMapsUrl: googleMapsDirectionsUrl(startIsRider ? null : points[0], points[points.length - 1], waypoints),
    pinnedAll: pinned.length === twisties.length && pins.every((twisty) => twisty.complete),
  }
}

/** Vertex ranges of the run's line, as `lineOf` builds it, that ride a one-way street against its way. */
function wrongWayRanges(steps: Step[], [first, last]: [number, number]): [number, number][] {
  const ranges: [number, number][] = []
  let vertex = 0
  for (const step of steps.slice(first, last + 1)) {
    if (step.againstOneWay) ranges.push([vertex, vertex + step.line.length])
    vertex += step.line.length
  }
  return ranges
}
