import { describe, expect, it } from 'vitest'
import { OneWay, RoadClass } from '../src/lib/data/graph'
import { graphFixture } from '../src/lib/testing/graphFixture'
import { benchTwistyM, trackEdgeCount, walkProblem, wrongWayM } from './checks'

//  0 -- 1 -- 2 -- 3 -- 4 -- 5 -- 6      edge i joins node i and i + 1
const nodes = Array.from({ length: 7 }, (_, i) => [i * 0.01, 0] as [number, number])
const edge = (from: number, lengthM: number, funShare: number, roadClass: number = RoadClass.Tertiary) => ({
  from,
  to: from + 1,
  timeS: lengthM / 10,
  lengthM,
  funM: lengthM * funShare,
  roadClass,
})

describe('benchTwistyM', () => {
  it('counts a long curvy run, closing short dull gaps in it', () => {
    const graph = graphFixture(nodes, [edge(0, 2_000, 1), edge(1, 600, 0), edge(2, 2_000, 1), edge(3, 5_000, 0)])
    expect(benchTwistyM(graph, [0, 1, 2, 3])).toBe(4_600)
  })

  it('leaves out a curvy run shorter than the minimum, and does not join runs across a long gap', () => {
    const graph = graphFixture(nodes, [edge(0, 2_000, 1), edge(1, 1_500, 0), edge(2, 2_000, 1), edge(3, 1_500, 1)])
    expect(benchTwistyM(graph, [0, 1, 2, 3])).toBe(3_500)
  })

  it('does not count tracks, however curvy', () => {
    const graph = graphFixture(nodes, [edge(0, 4_000, 1, RoadClass.Track), edge(1, 4_000, 1)])
    expect(benchTwistyM(graph, [0, 1])).toBe(4_000)
  })

  it('ignores roads that are only a little curvy', () => {
    const graph = graphFixture(nodes, [edge(0, 6_000, 0.3)])
    expect(benchTwistyM(graph, [0])).toBe(0)
  })
})

describe('walkProblem', () => {
  const graph = graphFixture(nodes, [edge(0, 100, 0), edge(1, 100, 0), edge(2, 100, 0), edge(5, 100, 0)])

  it('accepts a walk in either direction along the edges', () => {
    expect(walkProblem(graph, [0, 1, 2], 0, 3)).toBeNull()
    expect(walkProblem(graph, [2, 1, 0], 3, 0)).toBeNull()
  })

  it('names the edge that does not continue the walk', () => {
    expect(walkProblem(graph, [0, 2], 0, 3)).toMatch(/edge 1 \(2\) does not touch node 1/)
  })

  it('notices a walk that stops short or starts elsewhere', () => {
    expect(walkProblem(graph, [0, 1], 0, 3)).toMatch(/ends at node 2, not at 3/)
    expect(walkProblem(graph, [0, 1], 1, 3)).toMatch(/edge 1 \(1\) does not touch node 0/)
  })

  it('accepts no edges from a node to itself', () => {
    expect(walkProblem(graph, [], 2, 2)).toBeNull()
  })
})

describe('wrongWayM', () => {
  // Edge 1 (node 1 to 2, 300 m) is one-way.
  const graph = graphFixture(nodes, [edge(0, 100, 0), { ...edge(1, 300, 0), oneway: OneWay.Yes }, edge(2, 100, 0)])

  it('counts the metres ridden against a one-way edge, and nothing the right way', () => {
    expect(wrongWayM(graph, [0, 1, 2], 0)).toBe(0)
    expect(wrongWayM(graph, [2, 1, 0], 3)).toBe(300)
  })
})

describe('trackEdgeCount', () => {
  it('counts the edges of unpaved roads', () => {
    const graph = graphFixture(nodes, [edge(0, 100, 0), edge(1, 100, 0, RoadClass.Track), edge(2, 100, 0, RoadClass.Track)])
    expect(trackEdgeCount(graph, [0, 1, 2])).toBe(2)
  })
})
