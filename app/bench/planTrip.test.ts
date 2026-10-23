import { describe, expect, it } from 'vitest'
import { RoadClass } from '../src/lib/data/graph'
import { PlanningError } from '../src/lib/errors'
import { NodeLocator } from '../src/lib/routing/nodeLocator'
import { Planner } from '../src/lib/routing/planner'
import { graphFixture } from '../src/lib/testing/graphFixture'
import { planTrip } from './planTrip'
import { pinCount, routeId } from './results'
import type { BenchTrip } from './trips'

//  A -- B -- C        a motorway (fast) and, from B to C, a twisty alternative
//        \__/
const graph = graphFixture(
  [
    [0, 0],
    [0.03, 0],
    [0.06, 0],
  ],
  [
    { from: 0, to: 1, timeS: 300, lengthM: 5_000, roadClass: RoadClass.Primary },
    { from: 1, to: 2, timeS: 300, lengthM: 5_000, roadClass: RoadClass.Primary },
    { from: 1, to: 2, timeS: 700, lengthM: 5_000, funM: 4_800, roadClass: RoadClass.Tertiary, road: 1 },
    { from: 1, to: 2, timeS: 100, lengthM: 4_000, roadClass: RoadClass.Track },
  ],
  ['', 'CV-25'],
)
const trip: BenchTrip = { id: 't', kind: 'fixed', set: 'tuning', from: [0, 0], to: [0.06, 0], includeTracks: false }
const planner = new Planner(graph)
const locator = new NodeLocator(graph)

describe('planTrip', () => {
  it('records every stop with the identity of its route and counts what the plan cost', () => {
    const result = planTrip(planner, locator, trip)
    expect(result.failures).toEqual([])
    expect(result.options.length).toBeGreaterThan(1)
    expect(result.options[0]).toMatchObject({ extraS: 0, timeS: 600, twistyM: 0, benchTwistyM: 0, pins: 0 })
    expect(result.options.at(-1)?.benchTwistyM).toBe(5_000)
    expect(result.options.at(-1)?.twisties).toEqual([['CV-25', 5_000, expect.any(Number)]])
    expect(new Set(result.options.map((option) => option.routeId)).size).toBe(result.options.length)
    expect(result.settled).toBeGreaterThan(0)
    expect(result.defaultStop).toBe(result.options.findLastIndex((option) => option.extraS <= 45 * 60))
  })

  it('reports the same routes when it plans the same trip again', () => {
    const ids = (result: ReturnType<typeof planTrip>) => result.options.map((option) => option.routeId)
    expect(ids(planTrip(planner, locator, trip))).toEqual(ids(planTrip(planner, locator, trip)))
  })

  it('fails a plan that throws (H1)', () => {
    const throwing = { graph, settledNodes: 0, plan: () => { throw new PlanningError('tooFar') } }
    const result = planTrip(throwing, locator, trip)
    expect(result.options).toEqual([])
    expect(result.failures).toEqual([expect.stringMatching(/^H1 plans: /)])
  })

  it('fails an option whose edges are not a walk between the ends (H7)', () => {
    const [option] = planner.plan([trip.from, trip.to])
    const broken = { graph, settledNodes: 0, plan: () => [{ ...option, edges: [0] }] }
    expect(planTrip(broken, locator, trip).failures).toEqual([expect.stringMatching(/^H7 connected: stop 0/)])
  })

  it('fails an option that rides a track when tracks are off (H8)', () => {
    const [option] = planner.plan([trip.from, trip.to])
    const riding = { graph, settledNodes: 0, plan: () => [{ ...option, edges: [0, 3] }] }
    const failures = planTrip(riding, locator, trip).failures
    expect(failures).toEqual([expect.stringMatching(/^H8 noTracksWhenOff: stop 0 rides 1 track edges/)])
  })
})

describe('results', () => {
  it('counts the waypoints of a Google Maps URL', () => {
    expect(pinCount('https://www.google.com/maps/dir/?api=1&origin=1%2C2&destination=3%2C4')).toBe(0)
    expect(pinCount('https://www.google.com/maps/dir/?api=1&waypoints=1%2C2|3%2C4|5%2C6')).toBe(3)
  })

  it('identifies a route by its edges and scores, not by how it is shown', () => {
    const [option] = planner.plan([trip.from, trip.to])
    expect(routeId({ ...option, googleMapsUrl: 'elsewhere' })).toBe(routeId(option))
    expect(routeId({ ...option, edges: [...option.edges].reverse() })).not.toBe(routeId(option))
  })
})
