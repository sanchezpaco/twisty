import { describe, expect, it } from 'vitest'
import { EdgeFlag, RoadClass, stackLayer } from '../data/graph'
import { graphBuffer, graphFixture } from '../testing/graphFixture'
import { type Candidate, findCandidates } from './candidates'
import { Planner } from './planner'

// A road off the way, that no appetite finds: the links to it cost more than the motorway they replace, and nothing
// on them is fun, so no discount ever makes the detour the cheapest route.
//
//    D ~~ M ~~ E     the twisty road (two edges, 4 km, fun share 0.9)
//    |           |
//    A ======== B   motorway, one hour
const MOTORWAY_S = 3600
const LINK_S = 2000
const A_TO_B = 0
const A_TO_D = 1
const D_TO_M = 2
const M_TO_E = 3
const E_TO_B = 4

const offTheWay = ({ linkS = LINK_S, latitude = 0.004 } = {}) =>
  graphFixture(
    [
      [0, 0],
      [0.09, 0],
      [0.02, latitude],
      [0.07, latitude],
      [0.045, latitude + 0.002],
    ],
    [
      { from: 0, to: 1, timeS: MOTORWAY_S, roadClass: RoadClass.Motorway },
      { from: 0, to: 2, timeS: linkS, roadClass: RoadClass.Primary },
      { from: 2, to: 4, timeS: 150, lengthM: 2_000, funM: 1_800, road: 1 },
      { from: 4, to: 3, timeS: 150, lengthM: 2_000, funM: 1_800, road: 1 },
      { from: 3, to: 1, timeS: linkS, roadClass: RoadClass.Primary },
    ],
    ['', 'CV-35'],
  )

const A: [number, number] = [0, 0]
const B: [number, number] = [0.09, 0]

describe('the roads of the graph offered as candidates', () => {
  it('offers a road off the way that no appetite reaches, as one more option', () => {
    const [fastest, ...rest] = new Planner(offTheWay()).plan([A, B])
    expect(fastest.edges).toEqual([A_TO_B])
    expect(rest.map((option) => option.edges)).toEqual([[A_TO_D, D_TO_M, M_TO_E, E_TO_B]])
    expect(rest[0]).toMatchObject({ timeS: 2 * LINK_S + 300, extraS: 2 * LINK_S + 300 - MOTORWAY_S, coverageRoad: null })
    expect(rest[0].twisties.map((twisty) => twisty.label)).toEqual(['CV-35'])
  })

  it('rides the road the way the trip goes, whichever way round the candidate is stored', () => {
    const graph = offTheWay()
    const road: Candidate = {
      edges: [D_TO_M, M_TO_E],
      ends: [2, 3],
      lengthM: 4_000,
      funM: 3_600,
    }
    const reversed: Candidate = {
      edges: [M_TO_E, D_TO_M],
      ends: [3, 2],
      lengthM: 4_000,
      funM: 3_600,
    }
    for (const stored of [road, reversed]) {
      const planner = new Planner(graph, [stored])
      expect(planner.plan([A, B]).at(-1)?.edges).toEqual([A_TO_D, D_TO_M, M_TO_E, E_TO_B])
      expect(planner.plan([B, A]).at(-1)?.edges).toEqual([E_TO_B, M_TO_E, D_TO_M, A_TO_D])
    }
  })

  it('leaves out a road that cannot be reached', () => {
    const island = graphFixture(
      [
        [0, 0],
        [0.09, 0],
        [0.02, 0.004],
        [0.07, 0.004],
      ],
      [
        { from: 0, to: 1, timeS: MOTORWAY_S, roadClass: RoadClass.Primary },
        { from: 2, to: 3, timeS: 300, lengthM: 4_000, funM: 3_600, road: 1 },
      ],
      ['', 'CV-35'],
    )
    expect(new Planner(island, findCandidates(island)).plan([A, B])).toHaveLength(1)
  })

  // The road's own ride adds two links and the road (300 s) over the motorway hour; the cap on it is 90 minutes, 5,400 s.
  // The rider's budget is wide enough here not to be what leaves the road out.
  it('leaves out a road whose own ride adds more than the detour cap', () => {
    const budget = { maxExtraS: 5 * 3600 }
    expect(new Planner(offTheWay({ linkS: 4_400 })).plan([A, B], budget)).toHaveLength(1)
    expect(new Planner(offTheWay({ linkS: 4_300 })).plan([A, B], budget)).toHaveLength(2)
  })

  it('leaves out a road too far away for the time it would cost, whatever the graph says', () => {
    expect(new Planner(offTheWay({ latitude: 3 })).plan([A, B])).toHaveLength(1)
  })

  it('does not ride an edge twice to reach a road', () => {
    //  A ====== X ====== B     the spur X - D is the only way to the road, which ends at E
    //           |
    //           D ~~~~ E
    const spur = (loop: boolean) =>
      graphFixture(
        [
          [0, 0],
          [0.045, 0],
          [0.09, 0],
          [0.04, 0.004],
          [0.05, 0.004],
        ],
        [
          { from: 0, to: 1, timeS: 1_800, roadClass: RoadClass.Primary },
          { from: 1, to: 2, timeS: 1_800, roadClass: RoadClass.Primary },
          { from: 1, to: 3, timeS: 1_000, roadClass: RoadClass.Primary },
          { from: 3, to: 4, timeS: 300, lengthM: 4_000, funM: 3_600, road: 1 },
          ...(loop ? [{ from: 4, to: 1, timeS: 1_000, roadClass: RoadClass.Primary }] : []),
        ],
        ['', 'CV-35'],
      )
    const deadEnd = new Planner(spur(false), [{ edges: [3], ends: [3, 4], lengthM: 4_000, funM: 3_600 }])
    expect(deadEnd.plan([A, B])).toHaveLength(1)
    const loop = new Planner(spur(true), [{ edges: [3], ends: [3, 4], lengthM: 4_000, funM: 3_600 }])
    expect(loop.plan([A, B]).at(-1)?.edges).toEqual([0, 2, 3, 4, 1])
  })
})

// A road that every stop of the slider passes by, as a great road beside a better-known one often is:
//
//   A ~~~~ ... ~~~~ X1 ===== X2 ~~~~~~ B     twisty alt 1 (9 edges) beside the motorway, motorway, twisty alt 2
//           \                  /
//            g1 ~~~~~~~~~~~ g2               the great road, reached by a link at each end
//
// Alone, the great road is slower than the first stop and has fewer curves, so the slider drops it; together with the
// first stop (it replaces the last edge of alt 1 and the motorway) it is a step the rider would want.
describe('the great road no stop rides', () => {
  // The ninth node of a stop is the first one the planner measures from, so alt 1 is long enough to have one.
  const ALT_1_EDGES = 9
  const fastestEdges = [0, 1, 2]
  const alt1 = Array.from({ length: ALT_1_EDGES }, (_, i) => 3 + i)
  const [link1, link2, roadFirst, roadSecond, largerFirst, largerSecond] = [1, 2, 3, 4, 5, 6].map((i) => 3 + ALT_1_EDGES + i)

  const nodes: [number, number][] = [
    [0, 0],
    [0.03, 0],
    [0.06, 0],
    [0.09, 0],
    ...Array.from({ length: ALT_1_EDGES - 1 }, (_, i): [number, number] => [0.003 * (i + 1), 0.002]),
    [0.0295, 0.004],
    [0.055, 0.004],
    [0.04, 0.006],
    [0.04, 0.003],
  ]
  const [g1, g2, gMiddle, largerMiddle] = [nodes.length - 4, nodes.length - 3, nodes.length - 2, nodes.length - 1]
  const alt1Nodes = [0, ...Array.from({ length: ALT_1_EDGES - 1 }, (_, i) => 4 + i), 1]
  // The great roads are twisties of 8 and 10.8 km at scale 2, the least a great road rides on in (GREAT_MIN_TWISTY_M).
  const withLinks = (linkS: number, motorwayS = 1_200, { town = 0, scale = 2 } = {}) =>
    graphFixture(
      nodes,
      [
        { from: 0, to: 1, timeS: motorwayS, roadClass: RoadClass.Motorway },
        { from: 1, to: 2, timeS: motorwayS, roadClass: RoadClass.Motorway },
        { from: 2, to: 3, timeS: motorwayS, roadClass: RoadClass.Motorway },
        ...alt1Nodes.slice(1).map((to, i) => ({ from: alt1Nodes[i], to, timeS: 200, lengthM: 890, funM: 820, road: 1 })),
        { from: 2, to: 3, timeS: 1_800, lengthM: 8_000, funM: 7_200, road: 2 },
        { from: alt1Nodes[ALT_1_EDGES - 1], to: g1, timeS: linkS, roadClass: RoadClass.Primary },
        { from: g2, to: 2, timeS: linkS, roadClass: RoadClass.Primary },
        { from: g1, to: gMiddle, timeS: 300, lengthM: 2_000 * scale, funM: 1_950 * scale, road: 3, flags: town },
        { from: gMiddle, to: g2, timeS: 300, lengthM: 2_000 * scale, funM: 1_950 * scale, road: 3 },
        { from: g1, to: largerMiddle, timeS: 300, lengthM: 2_700 * scale, funM: 2_300 * scale, road: 4 },
        { from: largerMiddle, to: g2, timeS: 300, lengthM: 2_700 * scale, funM: 2_300 * scale, road: 4 },
      ],
      ['', 'CV-10', 'CV-20', 'GREAT-1', 'GREAT-2'],
    )
  const graph = withLinks(600)
  const great = (reversed: boolean): Candidate => ({
    edges: reversed ? [roadSecond, roadFirst] : [roadFirst, roadSecond],
    ends: reversed ? [g2, g1] : [g1, g2],
    lengthM: 8_000,
    funM: 7_800,
  })

  const covered = (options: { coverageRoad: string | null }[]) => options.flatMap((option) => (option.coverageRoad ? [option.coverageRoad] : []))

  // A rated 2 road (fun share 0.5) and a great one (0.975) between A and B: the first is 10 s faster with a little more
  // fun, so it alone is on the frontier; the great road's 19.5 km of fun buy it the stop.
  const choice = graphFixture(
    [
      [0, 0],
      [0.09, 0],
      [0.045, 0.01],
      [0.045, -0.01],
    ],
    [
      { from: 0, to: 1, timeS: 2_400, roadClass: RoadClass.Motorway },
      { from: 0, to: 2, timeS: 1_500, lengthM: 20_000, funM: 10_000, road: 1 },
      { from: 2, to: 1, timeS: 1_500, lengthM: 20_000, funM: 10_000, road: 1 },
      { from: 0, to: 3, timeS: 1_505, lengthM: 10_000, funM: 9_750, road: 2 },
      { from: 3, to: 1, timeS: 1_505, lengthM: 10_000, funM: 9_750, road: 2 },
    ],
    ['', 'CV-1', 'GREAT-3'],
  )
  it.each([false, true])('puts a great road on the slider over a ride with a little more fun, stored reversed: %s', (reversed) => {
    const plain: Candidate = { edges: [1, 2], ends: [0, 1], lengthM: 40_000, funM: 20_000 }
    const greatOne: Candidate = reversed ? { edges: [4, 3], ends: [1, 0], lengthM: 20_000, funM: 19_500 } : { edges: [3, 4], ends: [0, 1], lengthM: 20_000, funM: 19_500 }
    const options = new Planner(choice, [plain, greatOne]).plan([[0, 0], [0.09, 0]])
    expect(options[0].edges).toEqual([0])
    expect(covered(options)).toEqual(['GREAT-3'])
    expect(options.find((option) => option.coverageRoad)!.edges).toEqual([3, 4])
  })

  // Both fit the same place in the slider, so only one gets it: the one with more fun-km, though the other is rated higher.
  it('gives the stop to the road with the most fun-km, not to the best rated', () => {
    const rated5: Candidate = { edges: [roadFirst, roadSecond], ends: [g1, g2], lengthM: 8_000, funM: 7_800 }
    const larger: Candidate = { edges: [largerFirst, largerSecond], ends: [g1, g2], lengthM: 10_800, funM: 9_200 }
    for (const candidates of [
      [rated5, larger],
      [larger, rated5],
    ]) {
      expect(covered(new Planner(graph, candidates).plan([[0, 0], [0.09, 0]]))).toEqual(['GREAT-2'])
    }
  })

  it('makes no room for a road whose twisty is too short to be a great one, or half of which is a town', () => {
    const short = { ...great(false), lengthM: 4_000, funM: 3_900 }
    expect(covered(new Planner(withLinks(600, 1_200, { scale: 1 }), [short]).plan([[0, 0], [0.09, 0]]))).toEqual([])
    expect(covered(new Planner(withLinks(600, 1_200, { town: EdgeFlag.BuiltUp }), [great(false)]).plan([[0, 0], [0.09, 0]]))).toEqual([])
    expect(covered(new Planner(graph, [great(false)]).plan([[0, 0], [0.09, 0]]))).toEqual(['GREAT-1'])
  })

  it('does not take a road whose links cost more than its fun is worth', () => {
    expect(covered(new Planner(withLinks(1_300), [great(false)]).plan([[0, 0], [0.09, 0]]))).toEqual([])
  })

  // The ride of the road costs 800 s over the fastest; with the whole slider it gets a stop (the first test).
  it('does not take a road that costs more than the rider\'s budget', () => {
    expect(covered(new Planner(graph, [great(false)]).plan([[0, 0], [0.09, 0]], { maxExtraS: 700 }))).toEqual([])
  })

  it('does not put a road on the slider for itself when a stop already rides it', () => {
    const ridden: Candidate = { edges: alt1, ends: [0, 1], lengthM: 8_010, funM: 7_380 }
    expect(covered(new Planner(graph, [ridden]).plan([[0, 0], [0.09, 0]]))).toEqual([])
  })
})

describe('where the planner gets its candidates', () => {
  it('finds them once, when it first needs them, if it was not given any', () => {
    const planner = new Planner(offTheWay())
    const found = planner.allCandidates()
    expect(found).toEqual(findCandidates(offTheWay()))
    expect(planner.allCandidates()).toBe(found)
  })

  it('uses the ones it was given, and the planner of the stacked tracks uses the same ones', () => {
    const road: Candidate = { edges: [D_TO_M, M_TO_E], ends: [2, 3], lengthM: 4_000, funM: 3_600 }
    const roads = new Planner(offTheWay(), [road])
    expect(roads.allCandidates()).toEqual([road])

    const track = graphBuffer([[0.01, 0.001]], [{ from: 0, to: 5, timeS: 60, roadClass: RoadClass.Track }])
    const withTracks = new Planner(stackLayer(roads.graph, track), roads.allCandidates())
    expect(withTracks.allCandidates()).toBe(roads.allCandidates())
    expect(withTracks.plan([A, B], { includeTracks: true }).at(-1)?.edges).toEqual([A_TO_D, D_TO_M, M_TO_E, E_TO_B])
  })
})
