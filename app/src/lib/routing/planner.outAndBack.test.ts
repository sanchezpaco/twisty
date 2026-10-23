import { describe, expect, it } from 'vitest'
import { RoadClass } from '../data/graph'
import { graphFixture } from '../testing/graphFixture'
import { Planner } from './planner'

// A valley road off the main way, whose far end is dear to leave by the fastest path but cheap by an appetite route
// (a lane with some fun on it, below what a twisty needs). The fastest way out of the valley after its first twisty
// is the way in: a ride that stops there goes out and back, which a stretch of a route used to be offered as.
//
//        P ~ R ~ Q      P-R-Q and J-P: the valley, twisties J-P and R-Q (4 km, fun share 0.95), a dull link P-R
//       /         \
//  S ---- J ======= E   S-J and J-E: the main way, 15 minutes and then 10
const graph = graphFixture(
  [
    [0, 0],
    [0.03, 0],
    [0.04, 0.02],
    [0.05, 0.02],
    [0.06, 0.02],
    [0.09, 0],
  ],
  [
    { from: 0, to: 1, timeS: 300, lengthM: 6_000, roadClass: RoadClass.Primary, road: 3 },
    { from: 1, to: 5, timeS: 600, lengthM: 12_000, roadClass: RoadClass.Primary, road: 3 },
    { from: 1, to: 2, timeS: 400, lengthM: 4_000, funM: 3_800, road: 1 },
    { from: 2, to: 3, timeS: 100, lengthM: 1_500, road: 2 },
    { from: 3, to: 4, timeS: 400, lengthM: 4_000, funM: 3_800, road: 4 },
    { from: 4, to: 5, timeS: 1_200, lengthM: 3_000, funM: 1_050, road: 2 },
  ],
  ['', 'AS-1', 'Calle de la Vega', 'N-1', 'AS-2'],
)

describe('the rides of a plan', () => {
  it('never walk an edge twice', () => {
    const options = new Planner(graph).plan([[0, 0], [0.09, 0]])
    for (const option of options) expect(new Set(option.edges).size).toBe(option.edges.length)
  })
})
