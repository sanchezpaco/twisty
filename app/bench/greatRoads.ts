import { haversineM, type LonLat, pointAlong } from '../src/lib/geo'
import type { EdgeWeights } from '../src/lib/routing/edgeWeights'
import type { RideOption } from '../src/lib/routing/ride'
import type { ShortestPaths } from '../src/lib/routing/shortestPaths'
import { isRidden, type KnownRoad, type LocatedRoad, PolylineIndex } from './roads'
import type { BenchTrip } from './trips'

// Decided by the maintainer on 2026-10-14 (docs/route-quality-bench.md §9, questions 1 and 2).
/** A road is demanded of a trip when riding it adds at most this much to the fastest time. */
export const GREAT_ROAD_DEMAND_S = 90 * 60
/** Roads costing more than the demand but at most this much are measured and reported, never demanded. */
export const GREAT_ROAD_REPORT_S = 180 * 60
/** A planner that goes from A to B cannot ride a dead end without backtracking, so they are not demanded. */
export const EXCLUDE_DEAD_ENDS_FROM_DEMAND = true
/** Speed that bounds how fast a detour can be: no road is quicker than this on average. */
const LOWER_BOUND_KMH = 115

export interface KnownRoadContext {
  roads: { road: KnownRoad; located: LocatedRoad }[]
  /** Roads added after this date are held out of tuning: they only count on holdout trips. */
  tunedThrough: string | null
}

export interface GreatRoadResult {
  deadEnd: boolean
  /** Extra seconds over the fastest route to ride the road, whichever way. */
  costS: number
  /** Whether a stop of this trip is expected to ride it: located, within the demand, not a dead end, counted here. */
  demanded: boolean
  /** Index of the first stop that rides the road, or null. */
  foundAt: number | null
  /** Whether the stop with the most curves rides it. */
  lastRides: boolean
  /** Extra seconds of the first stop that rides it over `costS`: what the planner pays for it. */
  costRatio: number | null
}

export const isHoldoutRoad = (road: KnownRoad, tunedThrough: string | null): boolean => tunedThrough !== null && road.addedOn > tunedThrough

/** Whether a road counts on a trip: roads the tuning has not seen only count on trips it has not seen either. */
export function countsOn(road: KnownRoad, tunedThrough: string | null, trip: Pick<BenchTrip, 'set'>): boolean {
  return !isHoldoutRoad(road, tunedThrough) || trip.set === 'holdout'
}

/** Roads whose detour might fit: the straight-line lower bound of going through their middle. */
export function candidateRoads(context: KnownRoadContext, from: LonLat, to: LonLat): LocatedRoad[] {
  return context.roads
    .map(({ located }) => located)
    .filter((located) => {
      const middle = pointAlong(located.line, located.lengthM / 2)
      const extraM = haversineM(from, middle) + haversineM(middle, to) - haversineM(from, to)
      return extraM / 1000 / LOWER_BOUND_KMH <= GREAT_ROAD_REPORT_S / 3600
    })
}

/**
 * Detour cost of each road, from two time-only searches that reach every road's ends: forward from the trip's start and
 * backward from its end. A road is taken whichever way costs least; its own time is the same both ways.
 */
export function detourCosts(
  searches: { fromStart: ShortestPaths; fromEnd: ShortestPaths },
  weights: EdgeWeights,
  trip: { start: number; end: number; includeTracks: boolean },
  roads: LocatedRoad[],
): Map<string, number> {
  const costs = new Map<string, number>()
  if (roads.length === 0) return costs
  const ends = roads.flatMap((road) => [road.startNode, road.endNode])
  const timeOnly = weights.use(0, trip.includeTracks)
  searches.fromStart.search(trip.start, { targets: [trip.end, ...ends], weights: timeOnly })
  searches.fromEnd.search(trip.end, { targets: ends, weights: timeOnly })
  const fastestS = searches.fromStart.costTo(trip.end)
  for (const road of roads) {
    const via = (first: number, second: number) => searches.fromStart.costTo(first) + searches.fromEnd.costTo(second)
    const costS = road.timeS + Math.min(via(road.startNode, road.endNode), via(road.endNode, road.startNode)) - fastestS
    if (Number.isFinite(costS)) costs.set(road.id, costS)
  }
  return costs
}

/** What the options of a trip do with every known road the trip passes near enough to matter. */
export function greatRoadResults(
  context: KnownRoadContext,
  trip: BenchTrip,
  options: RideOption[],
  lines: PolylineIndex[],
  costs: Map<string, number>,
): Record<string, GreatRoadResult> {
  const results: Record<string, GreatRoadResult> = {}
  for (const { road, located } of context.roads) {
    const costS = costs.get(located.id)
    if (costS === undefined || costS > GREAT_ROAD_REPORT_S) continue
    const foundAt = lines.findIndex((index) => isRidden(index, located.line))
    const found = foundAt >= 0
    results[road.id] = {
      deadEnd: located.deadEnd,
      costS,
      demanded:
        costS <= GREAT_ROAD_DEMAND_S &&
        !(EXCLUDE_DEAD_ENDS_FROM_DEMAND && located.deadEnd) &&
        countsOn(road, context.tunedThrough, trip),
      foundAt: found ? foundAt : null,
      lastRides: lines.length > 0 && isRidden(lines[lines.length - 1], located.line),
      costRatio: found && costS > 0 ? options[foundAt].extraS / costS : null,
    }
  }
  return results
}

