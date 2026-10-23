import { describe, expect, it } from 'vitest'
import { EdgeFlag } from '../data/graph'
import { graphFixture } from '../testing/graphFixture'
import { bidirectionalEdges } from './bidirectional'
import { EdgeWeights } from './edgeWeights'
import { ShortestPaths } from './shortestPaths'

//   A ---- B      a destination-only lane, 100 s
//    \    /
//      C          the road round, 300 s
const graph = () =>
  graphFixture(
    [
      [0, 0],
      [0.02, 0],
      [0.01, -0.01],
    ],
    [
      { from: 0, to: 1, timeS: 100, flags: EdgeFlag.DestinationOnly },
      { from: 0, to: 2, timeS: 150 },
      { from: 2, to: 1, timeS: 150 },
    ],
  )

describe('EdgeWeights', () => {
  it('makes a destination-only lane no short cut, but a way in where it is the only one', () => {
    const g = graph()
    const weights = new EdgeWeights(g).use(0, false)
    expect(weights.of(0)).toBe(400)
    const route = (from: number, to: number) => bidirectionalEdges(new ShortestPaths(g), new ShortestPaths(g, 'backward'), from, to, weights)
    expect(route(0, 1)).toEqual([1, 2])
    const lane = graphFixture([[0, 0], [0.02, 0]], [{ from: 0, to: 1, timeS: 100, flags: EdgeFlag.DestinationOnly }])
    expect(bidirectionalEdges(new ShortestPaths(lane), new ShortestPaths(lane, 'backward'), 0, 1, new EdgeWeights(lane).use(0, false))).toEqual([0])
  })
})
