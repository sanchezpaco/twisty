import { describe, expect, it } from 'vitest'
import { RoadClass } from '../src/lib/data/graph'
import { EdgeWeights } from '../src/lib/routing/edgeWeights'
import { ShortestPaths } from '../src/lib/routing/shortestPaths'
import { graphFixture } from '../src/lib/testing/graphFixture'
import { cityCentreKm, sideLoops } from './defects'

//  A -- J ---------- K -- B     the main way, J to K in 10 minutes
//        \__ X ___/            a loop: two twisty edges of 8 minutes each, or two dull ones
const nodes: [number, number][] = [[0, 0], [0.03, 0], [0.06, 0], [0.045, 0.01], [0.09, 0]]
const road = (loopFun: number) =>
  graphFixture(
    nodes,
    [
      { from: 0, to: 1, timeS: 300, lengthM: 3_000, roadClass: RoadClass.Primary },
      { from: 1, to: 2, timeS: 600, lengthM: 6_000, roadClass: RoadClass.Primary },
      { from: 1, to: 3, timeS: 500, lengthM: 4_000, funM: loopFun, road: 1 },
      { from: 3, to: 2, timeS: 500, lengthM: 4_000, funM: loopFun, road: 1 },
      { from: 2, to: 4, timeS: 300, lengthM: 3_000, roadClass: RoadClass.Primary },
    ],
    ['', 'AS-1'],
  )

describe('sideLoops', () => {
  it('finds a loop that costs minutes, with the fun it buys over the fastest way', () => {
    const graph = road(3_600)
    const loops = sideLoops(graph, [0, 2, 3, 4], 0, new ShortestPaths(graph), new EdgeWeights(graph).use(0, false))
    expect(loops).toEqual([[6.7, 7.2, 'AS-1']])
  })

  it('finds a loop that buys nothing, and none on the fastest way', () => {
    const graph = road(0)
    const [searches, weights] = [new ShortestPaths(graph), new EdgeWeights(graph).use(0, false)]
    expect(sideLoops(graph, [0, 2, 3, 4], 0, searches, weights)).toEqual([[6.7, 0, 'AS-1']])
    expect(sideLoops(graph, [0, 1, 4], 0, searches, weights)).toEqual([])
  })
})

describe('cityCentreKm', () => {
  const streets = graphFixture(
    nodes,
    [
      { from: 0, to: 1, timeS: 300, lengthM: 3_000, roadClass: RoadClass.Primary },
      { from: 1, to: 2, timeS: 600, lengthM: 6_000, roadClass: RoadClass.Motorway },
      { from: 2, to: 4, timeS: 300, lengthM: 3_000, roadClass: RoadClass.Secondary },
    ],
    [''],
  )
  const middleOfFirst: [number, number] = [0.015, 0]
  const middleOfLast: [number, number] = [0.075, 0]

  it('counts the km of roads that are not fast inside the centre, and leaves the motorway out', () => {
    const cities = [{ name: 'Jaén', point: [0.04, 0] as [number, number] }, { name: 'Lleida', point: middleOfFirst }]
    expect(cityCentreKm(streets, [0, 1, 2], cities, [[10, 10]])).toEqual({ Lleida: 3, Jaén: 3 })
  })

  it('leaves out a city near either end of the trip', () => {
    expect(cityCentreKm(streets, [0, 1, 2], [{ name: 'Lleida', point: middleOfFirst }], [[0, 0], [0.09, 0]])).toEqual({})
    expect(cityCentreKm(streets, [0, 1, 2], [{ name: 'Murcia', point: middleOfLast }], [[0, 0], [0.09, 0]])).toEqual({})
  })
})
