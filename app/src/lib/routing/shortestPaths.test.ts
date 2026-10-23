import { describe, expect, it } from 'vitest'
import { edgeCoordinates, type Graph, OneWay, RoadClass } from '../data/graph'
import { graphFixture } from '../testing/graphFixture'
import { EdgeWeights } from './edgeWeights'
import { MinHeap } from './heap'
import { ShortestPaths } from './shortestPaths'

//  0 --10-- 1 --10-- 2
//   \               /
//    ------50-------
const triangle = () =>
  graphFixture(
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      { from: 0, to: 1, timeS: 10, geometry: [[0.5, 0.1]] },
      { from: 1, to: 2, timeS: 10 },
      { from: 2, to: 0, timeS: 50 },
    ],
  )

// 0 -> 1 runs east and 1 -> 2 back west, both one-way: going on from one to the other at 1 is a U-turn. The legal way
// from 0 to 2 goes on to the junction at 3, turns there and comes back to 1 on the two-way road (cheaper than the long
// two-way road from 3 to 2). Node 4 is a two-way stub so that 0 can be started from.
//   2 <------- 1
//   0 -------> 1 ---- 3
const uTurnRoad = (oneway: number = OneWay.Yes) =>
  graphFixture(
    [
      [0, 0],
      [0.01, 0],
      [0, 0.0005],
      [0.02, 0],
      [-0.01, 0],
    ],
    [
      { from: 0, to: 1, timeS: 10, oneway },
      { from: 1, to: 2, timeS: 10, oneway },
      { from: 1, to: 3, timeS: 10 },
      { from: 3, to: 2, timeS: 100 },
      { from: 4, to: 0, timeS: 10 },
    ],
  )

describe('MinHeap', () => {
  it('pops nodes in key order and grows as needed', () => {
    const heap = new MinHeap(2)
    ;[5, 1, 4, 2, 3].forEach((key) => heap.push(key * 10, key))
    const popped = []
    while (heap.size > 0) popped.push(heap.pop())
    expect(popped).toEqual([10, 20, 30, 40, 50])
  })
})

const travelTime = (graph: Graph) => new EdgeWeights(graph).use(0, true)

describe('ShortestPaths', () => {
  it('finds the fastest path', () => {
    const graph = triangle()
    const paths = new ShortestPaths(graph)
    paths.search(0, { weights: travelTime(graph) })
    expect(paths.costTo(2)).toBe(20)
    expect(paths.edgesTo(2)).toEqual([0, 1])
  })

  it('walks two-way edges in either direction', () => {
    const graph = triangle()
    const paths = new ShortestPaths(graph)
    paths.search(2, { weights: travelTime(graph) })
    expect(paths.costTo(0)).toBe(20)
    expect(paths.edgesTo(0)).toEqual([1, 0])
  })

  it('rides a one-way edge only from its first node, and a backward search walks it the other way', () => {
    // 0 -> 1 is one-way: from 1, node 0 is only reached the long way round, by 2.
    const graph = graphFixture(
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [
        { from: 0, to: 1, timeS: 10, oneway: OneWay.Yes },
        { from: 1, to: 2, timeS: 10 },
        { from: 2, to: 0, timeS: 50 },
      ],
    )
    const forward = new ShortestPaths(graph)
    forward.search(1, { weights: travelTime(graph) })
    expect(forward.costTo(0)).toBe(60)
    expect(forward.edgesTo(0)).toEqual([1, 2])
    // Backward from 1: what it costs to get to 1, so the one-way edge serves node 0.
    const backward = new ShortestPaths(graph, 'backward')
    backward.search(1, { weights: travelTime(graph) })
    expect(backward.costTo(0)).toBe(10)
    expect(backward.costTo(2)).toBe(10)
    expect(backward.edgesTo(0)).toEqual([0])
  })

  it('never turns back from one one-way edge onto another, forward or backward', () => {
    const graph = uTurnRoad()
    const forward = new ShortestPaths(graph)
    forward.search(0, { weights: travelTime(graph) })
    expect(forward.edgesTo(2)).toEqual([0, 2, 2, 1])
    const backward = new ShortestPaths(graph, 'backward')
    backward.search(2, { weights: travelTime(graph) })
    expect(backward.costTo(0)).toBe(40)
    expect(backward.edgesTo(0).toReversed()).toEqual([0, 2, 2, 1])
  })

  it('keeps the hairpins of two-way roads', () => {
    const graph = uTurnRoad(OneWay.No)
    const forward = new ShortestPaths(graph)
    forward.search(0, { weights: travelTime(graph) })
    expect(forward.edgesTo(2)).toEqual([0, 1])
  })

  it('resets between searches', () => {
    const graph = triangle()
    const paths = new ShortestPaths(graph)
    paths.search(0, { weights: travelTime(graph) })
    paths.search(1, { targets: [0], weights: travelTime(graph) })
    expect(paths.costTo(0)).toBe(10)
    expect(paths.costTo(2)).toBe(Infinity)
  })

  it('prefers fun roads once the appetite grows', () => {
    const graph = graphFixture(
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [
        { from: 0, to: 1, timeS: 10, lengthM: 100, funM: 100 },
        { from: 1, to: 2, timeS: 10, lengthM: 100, funM: 100 },
        { from: 2, to: 0, timeS: 15, lengthM: 100 },
      ],
    )
    const paths = new ShortestPaths(graph)
    const weights = new EdgeWeights(graph)
    paths.search(0, { weights: weights.use(0, true) })
    expect(paths.edgesTo(2)).toEqual([2])
    paths.search(0, { weights: weights.use(1, true) })
    expect(paths.edgesTo(2)).toEqual([0, 1])
  })

  it('closes tracks unless asked', () => {
    const graph = graphFixture(
      [
        [0, 0],
        [1, 0],
      ],
      [
        { from: 0, to: 1, timeS: 10, roadClass: RoadClass.Track },
        { from: 0, to: 1, timeS: 100 },
      ],
    )
    const paths = new ShortestPaths(graph)
    const weights = new EdgeWeights(graph)
    paths.search(0, { weights: weights.use(0, false) })
    expect(paths.edgesTo(1)).toEqual([1])
    paths.search(0, { weights: weights.use(0, true) })
    expect(paths.edgesTo(1)).toEqual([0])
  })

  it('returns edge geometry oriented by travel direction', () => {
    const graph = triangle()
    expect(edgeCoordinates(graph, 0, 1).map(([lon]) => lon)).toEqual([1, 0.5])
  })

  it('stops beyond the optional limit without waiting for optional targets, and settles those within it', () => {
    const graph = triangle()
    const paths = new ShortestPaths(graph)
    paths.search(0, { weights: travelTime(graph), targets: [], optionalTargets: [1, 2], optionalLimit: 15 })
    expect(paths.costTo(1)).toBe(10)
    expect(paths.costTo(2)).toBe(Infinity)
  })

  it('does not search past the optional limit when there are only optional targets', () => {
    const graph = triangle()
    const paths = new ShortestPaths(graph)
    paths.search(0, { weights: travelTime(graph), optionalTargets: [1, 2], optionalLimit: 15 })
    expect(paths.costTo(1)).toBe(10)
    expect(paths.costTo(2)).toBe(Infinity)
  })

  it('searches the whole graph when it has no targets at all', () => {
    const graph = triangle()
    const paths = new ShortestPaths(graph)
    paths.search(0, { weights: travelTime(graph) })
    expect(paths.costTo(2)).toBe(20)
  })
})
