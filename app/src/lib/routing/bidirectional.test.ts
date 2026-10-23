import { describe, expect, it } from 'vitest'
import { type Graph, isRideable, OneWay, otherEnd } from '../data/graph'
import { type FixtureEdge, graphFixture } from '../testing/graphFixture'
import { bidirectionalEdges } from './bidirectional'
import { EdgeWeights } from './edgeWeights'
import { ShortestPaths } from './shortestPaths'

/** Deterministic pseudo-random numbers in [0, 1), so a failing graph can be reproduced. */
function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 2 ** 32
    return state / 2 ** 32
  }
}

function randomGraph(seed: number, nodeCount: number, edgeCount: number, onewayShare = 0): Graph {
  const next = random(seed)
  const edges: FixtureEdge[] = Array.from({ length: edgeCount }, () => ({
    from: Math.floor(next() * nodeCount),
    to: Math.floor(next() * nodeCount),
    timeS: 1 + Math.floor(next() * 100),
    oneway: next() < onewayShare ? OneWay.Yes : OneWay.No,
    // All heading one way, so that no turn is a U-turn: those are tested on their own.
    headings: [0, 0] as [number, number],
  }))
  return graphFixture(
    Array.from({ length: nodeCount }, (_, i) => [i, 0]),
    edges,
  )
}

function costOf(graph: Graph, edges: number[]): number {
  return edges.reduce((sum, edge) => sum + graph.edgeTimeS[edge], 0)
}

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

describe('bidirectionalEdges', () => {
  it('finds a path as fast as a search from the source alone, on graphs of every density and share of one-way edges', () => {
    for (const [nodeCount, edgeCount, onewayShare] of [[40, 45, 0], [40, 80, 0], [60, 200, 0], [40, 80, 0.4], [60, 200, 0.6]]) {
      for (let seed = 1; seed <= 15; seed++) {
        const graph = randomGraph(seed, nodeCount, edgeCount, onewayShare)
        const [forward, backward, reference] = [new ShortestPaths(graph), new ShortestPaths(graph, 'backward'), new ShortestPaths(graph)]
        const weights = new EdgeWeights(graph).use(0, true)
        for (let source = 0; source < nodeCount; source += 7) {
          reference.search(source, { weights })
          for (let target = 0; target < nodeCount; target += 5) {
            const edges = bidirectionalEdges(forward, backward, source, target, weights)
            const expected = reference.costTo(target)
            if (expected === Infinity) {
              expect(edges).toBeNull()
              continue
            }
            expect(edges).not.toBeNull()
            expect(costOf(graph, edges as number[])).toBe(expected)
            expect(isRideable(graph, source, edges as number[])).toBe(true)
            let node = source
            for (const edge of edges as number[]) node = otherEnd(graph, edge, node)
            expect(node).toBe(target)
          }
        }
      }
    }
  })

  it('does not meet where the two halves would make a U-turn', () => {
    const graph = uTurnRoad()
    const [forward, backward] = [new ShortestPaths(graph), new ShortestPaths(graph, 'backward')]
    expect(bidirectionalEdges(forward, backward, 0, 2, new EdgeWeights(graph).use(0, true))).toEqual([0, 2, 2, 1])
  })

  it('returns no edges when the trip starts where it ends', () => {
    const graph = randomGraph(1, 10, 20)
    const [forward, backward] = [new ShortestPaths(graph), new ShortestPaths(graph, 'backward')]
    expect(bidirectionalEdges(forward, backward, 3, 3, new EdgeWeights(graph).use(0, true))).toEqual([])
  })
})
