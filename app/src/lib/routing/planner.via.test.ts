import { describe, expect, it } from 'vitest'
import { RoadClass } from '../data/graph'
import { PlanningError } from '../errors'
import { MAX_VIA } from '../googleMaps'
import { graphFixture } from '../testing/graphFixture'
import { passes, Planner } from './planner'

//      C           D       (two twisty roads, slower)
//    /   \       /   \
//   A ----- V ----- B      (motorway, faster)           E -- F  (an island)
const A: [number, number] = [0, 0]
const V: [number, number] = [0.08, 0]
const B: [number, number] = [0.16, 0]
const ISLAND: [number, number] = [0.5, 0]
const graph = () =>
  graphFixture(
    [A, V, B, [0.04, 0.015], [0.12, 0.015], ISLAND, [0.51, 0]],
    [
      { from: 0, to: 1, timeS: 600, lengthM: 9_000, roadClass: RoadClass.Motorway },
      { from: 0, to: 3, timeS: 400, lengthM: 5_000, funM: 4_500, road: 1 },
      { from: 3, to: 1, timeS: 400, lengthM: 5_000, funM: 4_500, road: 1 },
      { from: 1, to: 2, timeS: 600, lengthM: 9_000, roadClass: RoadClass.Motorway },
      { from: 1, to: 4, timeS: 400, lengthM: 5_000, funM: 4_500, road: 2 },
      { from: 4, to: 2, timeS: 400, lengthM: 5_000, funM: 4_500, road: 2 },
      { from: 5, to: 6, timeS: 60, lengthM: 1_000 },
    ],
    ['', 'CV-35', 'CV-36'],
  )
const failure = (plan: () => unknown) => {
  try {
    plan()
  } catch (error) {
    return error instanceof PlanningError ? { code: error.code, ...error.at } : error
  }
  return null
}

describe('Planner, a trip with stops', () => {
  it('ends the curviest option on the twisties of both legs', () => {
    const options = new Planner(graph()).plan([A, V, B])
    expect(options.map((option) => option.extraS)).toEqual([0, 400])
    const curviest = options.at(-1)!
    expect(curviest.twisties.map((twisty) => [twisty.label, twisty.leg])).toEqual([
      ['CV-35', 0],
      ['CV-36', 1],
    ])
    expect(curviest.legs.map((leg) => leg.timeS)).toEqual([800, 800])
  })

  it('changes nothing but the legs for a stop on the fastest line', () => {
    const [direct] = new Planner(graph()).plan([A, B])
    const [through] = new Planner(graph()).plan([A, V, B])
    expect(through.edges).toEqual(direct.edges)
    expect(through.legs).toHaveLength(2)
    expect(direct.legs).toHaveLength(1)
  })

  it('sends Google Maps through the stop', () => {
    for (const option of new Planner(graph()).plan([A, V, B])) {
      expect(new URL(option.googleMapsUrl).searchParams.get('waypoints')).toContain('0.00000,0.08000')
    }
  })

  it('plans a loop, turning back at the stop, and does not count a road ridden out and back twice', () => {
    const options = new Planner(graph()).plan([A, V, A])
    expect(options[0]).toMatchObject({ timeS: 1_200, edges: [0, 0] })
    // Out on CV-35 and back on it again is no more fun than out on it and back on the motorway, and slower; back through B
    // on CV-36 would leave V, come back past it and go on to A, which no rider asked for.
    expect(options.map((option) => option.extraS)).toEqual([0, 200])
    expect(options[1].edges.filter((edge) => edge === 1)).toHaveLength(1)
  })

  it('leaves a start at the rider out of every Google Maps link, and keeps the stops', () => {
    const urls = (startIsRider: boolean) => new Planner(graph()).plan([A, V, B], { startIsRider }).map((option) => new URL(option.googleMapsUrl).searchParams)
    expect(urls(false).every((params) => params.has('origin'))).toBe(true)
    expect(urls(true).some((params) => params.has('origin'))).toBe(false)
    expect(urls(true).every((params) => params.get('waypoints')?.includes('0.00000,0.08000'))).toBe(true)
  })

  it('names the leg with no road and the point far from any', () => {
    expect(failure(() => new Planner(graph()).plan([A, V, ISLAND]))).toEqual({ code: 'noConnection', leg: 1 })
    expect(failure(() => new Planner(graph()).plan([A, [40, 40], B]))).toEqual({ code: 'tooFar', point: 1 })
  })

  it('names the leg whose two points snap to one spot of the graph', () => {
    const nearA: [number, number] = [0.001, 0.001]
    expect(failure(() => new Planner(graph()).plan([A, nearA]))).toEqual({ code: 'sameSpot', leg: 0 })
    expect(failure(() => new Planner(graph()).plan([A, V, [0.081, 0], B]))).toEqual({ code: 'sameSpot', leg: 1 })
  })

  it('takes no more stops than Google Maps can follow', () => {
    expect(() => new Planner(graph()).plan([A, ...Array(MAX_VIA + 1).fill(V), B])).toThrow()
  })
})

describe('passes', () => {
  // Nodes every 10 km along the equator, and a ride out along them.
  const KM = 1 / 111.195
  const line = graphFixture(
    [0, 10, 20, 30].map((km): [number, number] => [km * KM, 0]),
    [0, 1, 2].map((i) => ({ from: i, to: i + 1, timeS: 600, lengthM: 10_000 })),
  )
  const at = (km: number): [number, number] => [km * KM, 0]

  it('is a ride that comes near the point from afar and goes on away from it', () => {
    expect(passes(line, 0, [0, 1], at(10))).toBe(true)
    expect(passes(line, 3, [2, 1, 0], at(10))).toBe(true)
  })

  it('is not a ride that ends at the point, or only leaves it', () => {
    expect(passes(line, 0, [0], at(10))).toBe(false)
    expect(passes(line, 1, [1, 2], at(10))).toBe(false)
  })

  it('is not a short trip that leaves from near its end and comes back to it', () => {
    expect(passes(line, 0, [0, 1, 2, 2, 1, 0], at(1))).toBe(false)
  })
})
