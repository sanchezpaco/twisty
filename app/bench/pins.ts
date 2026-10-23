import type { Graph } from '../src/lib/data/graph'
import type { LonLat } from '../src/lib/geo'
import { bidirectionalEdges } from '../src/lib/routing/bidirectional'
import type { EdgeWeights } from '../src/lib/routing/edgeWeights'
import type { NodeLocator } from '../src/lib/routing/nodeLocator'
import type { ShortestPaths } from '../src/lib/routing/shortestPaths'
import { rideLine } from './metrics'
import { PolylineIndex, RIDDEN_TOLERANCE_M, resample } from './roads'

/** The waypoints of a Google Maps directions URL, as [lon, lat]. */
export function urlWaypoints(url: string): LonLat[] {
  const waypoints = new URL(url).searchParams.get('waypoints')
  if (!waypoints) return []
  return waypoints.split('|').map((pair) => {
    const [lat, lon] = pair.split(',').map(Number)
    return [lon, lat]
  })
}

export interface PinTools {
  graph: Graph
  locator: NodeLocator
  searches: { forward: ShortestPaths; backward: ShortestPaths }
  weights: EdgeWeights
}

/**
 * What Google Maps would ride between the origin, the pins and the destination: the fastest road between each two,
 * which is how a navigation app with its own speeds is approximated. Null when a leg has no road.
 */
export function pinnedRoute(tools: PinTools, origin: LonLat, pins: LonLat[], destination: LonLat): LonLat[] | null {
  const nodes = [origin, ...pins, destination].map((point) => tools.locator.nearest(point))
  if (nodes.some((node) => node < 0)) return null
  const timeOnly = tools.weights.use(0, false)
  const line: LonLat[] = []
  for (let leg = 1; leg < nodes.length; leg++) {
    const edges = bidirectionalEdges(tools.searches.forward, tools.searches.backward, nodes[leg - 1], nodes[leg], timeOnly)
    if (!edges) return null
    line.push(...rideLine(tools.graph, edges, nodes[leg - 1]))
  }
  return line
}

/** R13 and the proxy for "Google Maps follows the ride": the share of the twisty km the pinned route also rides. */
export function pinFidelity(tools: PinTools, twisties: { line: LonLat[]; lengthM: number }[], googleMapsUrl: string, origin: LonLat, destination: LonLat): number | null {
  const totalM = twisties.reduce((sum, twisty) => sum + twisty.lengthM, 0)
  if (totalM === 0) return null
  const route = pinnedRoute(tools, origin, urlWaypoints(googleMapsUrl), destination)
  if (!route) return 0
  const index = new PolylineIndex([route])
  const covered = twisties.reduce((sum, twisty) => {
    const samples = resample(twisty.line)
    return sum + (twisty.lengthM * samples.filter((sample) => index.distanceM(sample) <= RIDDEN_TOLERANCE_M).length) / samples.length
  }, 0)
  return covered / totalM
}
