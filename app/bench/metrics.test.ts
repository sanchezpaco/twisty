import { describe, expect, it } from 'vitest'
import { OneWay, RoadClass } from '../src/lib/data/graph'
import type { LonLat } from '../src/lib/geo'
import { graphFixture } from '../src/lib/testing/graphFixture'
import { backtrackM, carriagewayUTurns, PlaceIndex, regressM, revisitedNodes, rideLine, sharpTurns, slowDullM, straightInTwistyM, suspiciousM, townWrongWay } from './metrics'

//  0 -- 1 -- 2 -- 3 -- 4        edges 0..3, 1 km each; edge 4 joins 1 and 3 (a loop through 2)
const graph = graphFixture(
  Array.from({ length: 5 }, (_, i) => [i * 0.01, 0] as LonLat),
  [
    { from: 0, to: 1, timeS: 60, lengthM: 1_000 },
    { from: 1, to: 2, timeS: 60, lengthM: 1_000 },
    { from: 2, to: 3, timeS: 60, lengthM: 1_000 },
    { from: 3, to: 4, timeS: 60, lengthM: 1_000 },
    { from: 1, to: 3, timeS: 60, lengthM: 2_500 },
  ],
)

describe('backtracking and loops', () => {
  it('counts an edge ridden again once for each repeat', () => {
    expect(backtrackM(graph, [0, 1, 2, 3])).toBe(0)
    expect(backtrackM(graph, [0, 1, 1, 0])).toBe(2_000)
    expect(backtrackM(graph, [1, 1, 1])).toBe(2_000)
  })

  it('counts the nodes a walk comes back to', () => {
    expect(revisitedNodes(graph, [0, 1, 2, 3], 0)).toBe(0)
    expect(revisitedNodes(graph, [1, 2, 4], 1)).toBe(1)
    expect(revisitedNodes(graph, [0, 0], 0)).toBe(1)
  })
})

describe('slow dull road and suspicious names', () => {
  const road = graphFixture(
    Array.from({ length: 6 }, (_, i) => [i * 0.01, 0] as LonLat),
    [
      { from: 0, to: 1, timeS: 200, lengthM: 1_000 },
      { from: 1, to: 2, timeS: 200, lengthM: 1_000, funM: 500 },
      { from: 2, to: 3, timeS: 40, lengthM: 1_000 },
      { from: 3, to: 4, timeS: 200, lengthM: 1_000, roadClass: RoadClass.Link },
      { from: 4, to: 5, timeS: 200, lengthM: 1_000, roadClass: RoadClass.Track, road: 1 },
    ],
    ['', 'Camino de la Solana'],
  )

  it('counts only slow stretches with no fun, and not links or tracks', () => {
    expect(slowDullM(road, [0, 1, 2, 3, 4])).toBe(1_000)
  })

  it('counts tarmac named like a track, not tracks themselves', () => {
    const named = graphFixture(
      [[0, 0], [0.01, 0], [0.02, 0]],
      [
        { from: 0, to: 1, timeS: 60, lengthM: 1_500, road: 1 },
        { from: 1, to: 2, timeS: 60, lengthM: 800, road: 1, roadClass: RoadClass.Track },
      ],
      ['', 'Camino de la Solana'],
    )
    expect(suspiciousM(named, [0, 1])).toBe(1_500)
    expect(suspiciousM(graph, [0, 1])).toBe(0)
  })
})

describe('the dull road inside a twisty', () => {
  // Two curvy runs of one road with a dull bit of `dullM` between them.
  const roadWithDullBit = (dullM: number) =>
    graphFixture(
      [[0, 0], [0.05, 0], [0.1, 0], [0.15, 0]],
      [
        { from: 0, to: 1, timeS: 300, lengthM: 4_000, funM: 3_600, road: 1 },
        { from: 1, to: 2, timeS: 300, lengthM: dullM, road: 1 },
        { from: 2, to: 3, timeS: 300, lengthM: 4_000, funM: 3_600, road: 1 },
      ],
      ['', 'N-322'],
    )

  it('measures the longest dull run the twisty swallows', () => {
    expect(straightInTwistyM(roadWithDullBit(2_500), [0, 1, 2])).toBe(2_500)
  })

  it('has nothing to measure when the twisties are kept apart', () => {
    expect(straightInTwistyM(roadWithDullBit(40_000), [0, 1, 2])).toBe(0)
  })
})

describe('the ride as a line, and how far it moves away from the end', () => {
  it('lists the points of the edges in the order they are ridden', () => {
    expect(rideLine(graph, [0, 1], 0).map(([lon]) => lon)).toEqual([0, 0.01, 0.02].map(Math.fround))
    expect(rideLine(graph, [1, 0], 2).map(([lon]) => lon)).toEqual([0.02, 0.01, 0].map(Math.fround))
  })

  it('counts the metres ridden away from the destination', () => {
    const out: LonLat[] = [[0, 40], [0.02, 40]]
    expect(regressM(out, [0.1, 40])).toBe(0)
    expect(regressM([[0, 40], [0.02, 40], [0, 40]], [0.1, 40])).toBeGreaterThan(1_500)
  })
})

describe('towns near a route', () => {
  const places: LonLat[] = [[0.01, 40.005], [0.01, 40.1], [0.5, 40]]
  const index = new PlaceIndex(places)

  it('finds the places within the radius of the line and no others', () => {
    expect([...index.near([[0, 40], [0.05, 40]], 2_000)]).toEqual([0])
    expect([...index.near([[0, 40], [0.05, 40]], 20_000)].sort()).toEqual([0, 1])
  })
})

describe('sharp turns', () => {
  //   3 <- ramp, back up the way it came          a motorway 0 -> 1 -> 2 east; a ramp from 1 back west to 3, a road
  //  /                                             on to the north at 2 (a plain turn); 4 is a hairpin of one road
  // 0 ---- 1 ---- 2 ---- 4
  //               |
  //               5
  const turns = graphFixture(
    [
      [0, 0],
      [0.01, 0],
      [0.02, 0],
      [0.0, 0.001],
      [0.03, 0],
      [0.02, -0.01],
    ],
    [
      { from: 0, to: 1, timeS: 60, road: 1 },
      { from: 1, to: 3, timeS: 60, road: 2 },
      { from: 1, to: 2, timeS: 60, road: 1 },
      { from: 2, to: 5, timeS: 60, road: 3 },
      { from: 2, to: 4, timeS: 60, road: 1 },
      { from: 4, to: 2, timeS: 60, road: 1, geometry: [[0.025, 0.0002]] },
    ],
    ['', 'V-30', 'ramp', 'CV-30'],
  )

  it('counts a turn onto another road that doubles back, and neither a plain turn nor a hairpin of one road', () => {
    expect(sharpTurns(turns, [0, 1], 0)).toBe(1)
    expect(sharpTurns(turns, [0, 2, 3], 0)).toBe(0)
    expect(sharpTurns(turns, [2, 4, 5], 1)).toBe(0)
  })
})

describe('carriageway U-turns and town one-way streets', () => {
  // 0 -> 1 and 1 -> 2 are the two carriageways of a road that ends at 1; 2 - 3 is a town street, one-way from 2 to 3.
  const road = graphFixture(
    [
      [0, 0],
      [0.01, 0],
      [0, 0.0005],
      [0.01, 0.01],
    ],
    [
      { from: 0, to: 1, timeS: 60, oneway: OneWay.Yes },
      { from: 1, to: 2, timeS: 60, oneway: OneWay.Yes },
      { from: 2, to: 3, timeS: 60, lengthM: 1_500, oneway: OneWay.InTown },
    ],
  )

  it('counts a turn back from one carriageway onto the other', () => {
    expect(carriagewayUTurns(road, [0, 1], 0)).toBe(1)
  })

  it('measures a town street ridden against its direction and the waypoints Google gets on it', () => {
    expect(townWrongWay(road, [2], 2, [[0.005, 0.005]])).toEqual({ metres: 0, waypoints: 0 })
    expect(townWrongWay(road, [2], 3, [[0.005, 0.00525], [0.5, 0.5]])).toEqual({ metres: 1_500, waypoints: 1 })
  })
})
