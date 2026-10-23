import { describe, expect, it } from 'vitest'
import type { LonLat } from '../src/lib/geo'
import { EdgeWeights } from '../src/lib/routing/edgeWeights'
import type { RideOption } from '../src/lib/routing/ride'
import { ShortestPaths } from '../src/lib/routing/shortestPaths'
import { graphFixture } from '../src/lib/testing/graphFixture'
import {
  candidateRoads,
  countsOn,
  detourCosts,
  GREAT_ROAD_DEMAND_S,
  greatRoadResults,
  isHoldoutRoad,
  type KnownRoadContext,
} from './greatRoads'
import { type KnownRoad, type LocatedRoad, PolylineIndex } from './roads'
import type { BenchTrip } from './trips'

//  A ------ B ------ C      the fastest way, 600 s each
//           |        |
//           3 ~~~~~~ 4      the road: 300 s between 3 and 4, 200 s to reach it and 200 s to leave it
const graph = graphFixture(
  [
    [0, 40],
    [0.1, 40],
    [0.2, 40],
    [0.1, 40.05],
    [0.2, 40.05],
  ],
  [
    { from: 0, to: 1, timeS: 600 },
    { from: 1, to: 2, timeS: 600 },
    { from: 1, to: 3, timeS: 200 },
    { from: 3, to: 4, timeS: 300 },
    { from: 4, to: 2, timeS: 200 },
  ],
)
const line: LonLat[] = [[0.1, 40.05], [0.2, 40.05]]
const located = (id: string, deadEnd = false): LocatedRoad => ({ id, edges: [3], line, lengthM: 8_500, timeS: 300, startNode: 3, endNode: 4, deadEnd })
const known = (id: string, addedOn = '2026-10-13'): KnownRoad => ({ id, ref: 'X-1', region: 'Test', from: line[0], to: line[1], why: 'test', addedBy: 'test', addedOn })

describe('detourCosts', () => {
  const searches = { fromStart: new ShortestPaths(graph), fromEnd: new ShortestPaths(graph, 'backward') }
  const weights = new EdgeWeights(graph)

  it('costs the time of reaching the road, riding it and leaving it, over the fastest route', () => {
    const costs = detourCosts(searches, weights, { start: 0, end: 2, includeTracks: false }, [located('road')])
    expect(costs.get('road')).toBe(600 + 200 + 300 + 200 - 1200)
  })

  it('takes the cheaper direction of the road', () => {
    const costs = detourCosts(searches, weights, { start: 2, end: 0, includeTracks: false }, [located('road')])
    expect(costs.get('road')).toBe(100)
  })

  it('has nothing to say about no roads', () => {
    expect(detourCosts(searches, weights, { start: 0, end: 2, includeTracks: false }, []).size).toBe(0)
  })
})

describe('which roads a trip might pass', () => {
  const context: KnownRoadContext = { roads: [{ road: known('road'), located: located('road') }], tunedThrough: null }

  it('keeps a road near the trip and drops one far from it', () => {
    expect(candidateRoads(context, [0, 40], [0.2, 40])).toHaveLength(1)
    expect(candidateRoads(context, [-4, 37], [-3, 37])).toHaveLength(0)
  })
})

describe('roads held out of tuning', () => {
  it('count only on holdout trips once a tuning has been accepted', () => {
    expect(isHoldoutRoad(known('a', '2026-10-13'), null)).toBe(false)
    expect(isHoldoutRoad(known('a', '2026-10-13'), '2026-10-14')).toBe(false)
    expect(isHoldoutRoad(known('a', '2026-10-15'), '2026-10-14')).toBe(true)
    expect(countsOn(known('a', '2026-10-15'), '2026-10-14', { set: 'tuning' })).toBe(false)
    expect(countsOn(known('a', '2026-10-15'), '2026-10-14', { set: 'holdout' })).toBe(true)
    expect(countsOn(known('a', '2026-10-13'), '2026-10-14', { set: 'tuning' })).toBe(true)
  })
})

describe('greatRoadResults', () => {
  const option = (extraS: number, riding: boolean) =>
    ({ extraS, segments: [{ kind: 'transit', line: riding ? line : [[0, 40], [0.2, 40]] }] }) as unknown as RideOption
  const trip: BenchTrip = { id: 't', kind: 'fixed', set: 'tuning', from: [0, 40], to: [0.2, 40], includeTracks: false }
  const indexed = (options: RideOption[]): [RideOption[], PolylineIndex[]] => [options, options.map((option) => new PolylineIndex(option.segments.map((segment) => segment.line)))]
  const context = (deadEnd = false): KnownRoadContext => ({ roads: [{ road: known('road'), located: located('road', deadEnd) }], tunedThrough: null })

  it('finds the first stop that rides the road, and what it cost compared with the road', () => {
    const result = greatRoadResults(context(), trip, ...indexed([option(0, false), option(300, true), option(900, true)]), new Map([['road', 100]]))
    expect(result.road).toEqual({ deadEnd: false, costS: 100, demanded: true, foundAt: 1, lastRides: true, costRatio: 3 })
  })

  it('reports a road no stop rides', () => {
    const result = greatRoadResults(context(), trip, ...indexed([option(0, false), option(300, false)]), new Map([['road', 100]]))
    expect(result.road).toMatchObject({ demanded: true, foundAt: null, lastRides: false, costRatio: null })
  })

  it('does not demand a road that costs more than the demand, or a dead end, but still reports them', () => {
    const costly = greatRoadResults(context(), trip, ...indexed([option(0, false)]), new Map([['road', GREAT_ROAD_DEMAND_S + 60]]))
    expect(costly.road).toMatchObject({ demanded: false, costS: GREAT_ROAD_DEMAND_S + 60 })
    const deadEnd = greatRoadResults(context(true), trip, ...indexed([option(0, false)]), new Map([['road', 100]]))
    expect(deadEnd.road).toMatchObject({ demanded: false, deadEnd: true })
  })

  it('leaves out roads too costly to be worth measuring', () => {
    expect(greatRoadResults(context(), trip, ...indexed([option(0, false)]), new Map([['road', 10 * 3600]]))).toEqual({})
    expect(greatRoadResults(context(), trip, ...indexed([option(0, false)]), new Map())).toEqual({})
  })
})
