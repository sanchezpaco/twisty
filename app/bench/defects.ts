import { type Graph, nodePosition, otherEnd, RoadClass } from '../src/lib/data/graph'
import { haversineM, type LonLat } from '../src/lib/geo'
import type { EdgeWeights } from '../src/lib/routing/edgeWeights'
import type { ShortestPaths } from '../src/lib/routing/shortestPaths'
import { CITY_CENTRE_RADIUS_M, CITY_ENDS_M, LOOP_CHORD_MAX_S, LOOP_WASTE_MIN_S, type SideLoop } from './checks'

export interface City {
  name: string
  point: LonLat
}

const FAST_CLASSES = new Set<number>([RoadClass.Motorway, RoadClass.Trunk, RoadClass.Link])

/**
 * R16: km of the ride on roads that are not fast inside the centre of each city the trip does not start or end near.
 * An edge is inside when its midpoint is.
 */
export function cityCentreKm(graph: Graph, edges: number[], cities: City[], ends: LonLat[]): Record<string, number> {
  const strangers = cities.filter(({ point }) => ends.every((end) => haversineM(end, point) > CITY_ENDS_M))
  const km: Record<string, number> = {}
  for (const edge of edges) {
    if (FAST_CLASSES.has(graph.edgeClass[edge])) continue
    const [from, to] = [nodePosition(graph, graph.edgeFrom[edge]), nodePosition(graph, graph.edgeTo[edge])]
    const middle: LonLat = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
    for (const { name, point } of strangers) {
      if (haversineM(middle, point) <= CITY_CENTRE_RADIUS_M) km[name] = (km[name] ?? 0) + graph.edgeLengthM[edge] / 1000
    }
  }
  return Object.fromEntries(Object.entries(km).map(([name, value]) => [name, Math.round(value * 10) / 10]))
}

interface Walk {
  from: number
  to: number
  wasteS: number
  chordEdges: number[]
}

/**
 * R17: the side loops of a ride, the biggest first and none inside another: a stretch between two of its own nodes that
 * the fastest way joins within `LOOP_CHORD_MAX_S` and the ride takes `LOOP_WASTE_MIN_S` longer to cover. A twisty road
 * off a motorway is one; what tells a poor one is the fun it buys over the fastest way, which is its second number.
 */
export function sideLoops(graph: Graph, edges: number[], start: number, searches: ShortestPaths, weights: EdgeWeights): SideLoop[] {
  const nodes = [start]
  const timeS = [0]
  for (const edge of edges) {
    nodes.push(otherEnd(graph, edge, nodes[nodes.length - 1]))
    timeS.push(timeS[timeS.length - 1] + graph.edgeTimeS[edge])
  }
  const lastVisit = new Map(nodes.map((node, index) => [node, index]))
  const found: Walk[] = []
  for (let from = 0; from < nodes.length; from++) {
    const best = wastefulestReturn(from, nodes[from], { lastVisit, timeS, searches, weights })
    if (best) found.push(best)
  }
  const kept: Walk[] = []
  for (const walk of found.sort((a, b) => b.wasteS - a.wasteS)) {
    if (kept.every((other) => walk.to <= other.from || walk.from >= other.to)) kept.push(walk)
  }
  return kept
    .sort((a, b) => a.from - b.from)
    .map(({ from, to, wasteS, chordEdges }): SideLoop => {
      const ridden = edges.slice(from, to)
      const funM = (list: number[]) => list.reduce((sum, edge) => sum + graph.edgeFunM[edge], 0)
      return [Math.round(wasteS / 6) / 10, Math.round((funM(ridden) - funM(chordEdges)) / 100) / 10, mostRiddenRoad(graph, ridden)]
    })
}

/** The later node of the ride, within the chord limit of `node`, that the ride reaches the slowest compared with the fastest way. */
function wastefulestReturn(
  from: number,
  node: number,
  { lastVisit, timeS, searches, weights }: { lastVisit: Map<number, number>; timeS: number[]; searches: ShortestPaths; weights: EdgeWeights },
): Walk | null {
  searches.start(node)
  let best: Walk | null = null
  while (searches.nextKey() <= LOOP_CHORD_MAX_S) {
    const reached = searches.settleNext(weights)
    const to = lastVisit.get(reached)
    if (to === undefined || to <= from) continue
    const wasteS = timeS[to] - timeS[from] - searches.costTo(reached)
    if (wasteS >= LOOP_WASTE_MIN_S && (!best || wasteS > best.wasteS)) best = { from, to, wasteS, chordEdges: searches.edgesTo(reached) }
  }
  return best
}

function mostRiddenRoad(graph: Graph, edges: number[]): string {
  const metres = new Map<string, number>()
  for (const edge of edges) {
    const label = graph.roadNames[graph.edgeRoad[edge]] || '(unnamed)'
    metres.set(label, (metres.get(label) ?? 0) + graph.edgeLengthM[edge])
  }
  return [...metres].sort((a, b) => b[1] - a[1])[0][0]
}
