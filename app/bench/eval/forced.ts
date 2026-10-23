import type { EdgeWeights } from '../../src/lib/routing/edgeWeights'
import type { ShortestPaths } from '../../src/lib/routing/shortestPaths'
import type { LocatedRoad } from '../roads'

export interface ForcedRoute {
  start: number
  edges: number[]
}

/**
 * The fastest route from the start to the end that rides the whole road, whichever way: the route whose extra time is
 * the detour cost the bench demands. `null` when the road cannot be reached.
 *
 * The searches are those of one trip: forward from its start and backward from its end, each reaching the ends of every
 * road asked for.
 */
export function forcedRoutes(
  searches: { fromStart: ShortestPaths; fromEnd: ShortestPaths },
  weights: EdgeWeights,
  trip: { start: number; end: number; includeTracks: boolean },
  roads: LocatedRoad[],
): Map<string, ForcedRoute | null> {
  const ends = roads.flatMap((road) => [road.startNode, road.endNode])
  const timeOnly = weights.use(0, trip.includeTracks)
  searches.fromStart.search(trip.start, { targets: [trip.end, ...ends], weights: timeOnly })
  searches.fromEnd.search(trip.end, { targets: ends, weights: timeOnly })
  return new Map(roads.map((road) => [road.id, forcedRoute(searches, trip, road)]))
}

function forcedRoute(searches: { fromStart: ShortestPaths; fromEnd: ShortestPaths }, trip: { start: number }, road: LocatedRoad): ForcedRoute | null {
  const via = (first: number, second: number) => searches.fromStart.costTo(first) + searches.fromEnd.costTo(second)
  const forward = via(road.startNode, road.endNode)
  const backward = via(road.endNode, road.startNode)
  if (!Number.isFinite(Math.min(forward, backward))) return null
  const [first, last, along] = forward <= backward ? [road.startNode, road.endNode, road.edges] : [road.endNode, road.startNode, [...road.edges].reverse()]
  return { start: trip.start, edges: [...searches.fromStart.edgesTo(first), ...along, ...searches.fromEnd.edgesTo(last).reverse()] }
}
