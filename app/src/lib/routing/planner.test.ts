import { describe, expect, it } from 'vitest'
import { isRideable, OneWay, RoadClass } from '../data/graph'
import { graphFixture } from '../testing/graphFixture'
import { Planner } from './planner'

//        C (twisty mountain road, slower)
//      /   \
//    A ----- B (motorway, faster)
const trip = () =>
  graphFixture(
    [
      [0, 0],
      [0.08, 0],
      [0.04, 0.015],
    ],
    [
      { from: 0, to: 1, timeS: 600, lengthM: 9_000, roadClass: RoadClass.Motorway },
      { from: 0, to: 2, timeS: 400, lengthM: 5_000, funM: 4_500, road: 1 },
      { from: 2, to: 1, timeS: 400, lengthM: 5_000, funM: 4_500, road: 1 },
    ],
    ['', 'CV-35'],
  )

describe('Planner', () => {
  it('offers the motorway first and the twisty road as the curvier option', () => {
    const [fastest, curvy, ...rest] = new Planner(trip()).plan([[0, 0], [0.08, 0]])
    expect(rest).toHaveLength(0)
    expect(fastest).toMatchObject({ timeS: 600, extraS: 0, motorwayM: 9_000, twistyM: 0, twisties: [] })
    expect(curvy).toMatchObject({ timeS: 800, extraS: 200, curvyM: 9_000, twistyM: 10_000, motorwayM: 0, otherM: 0 })
    expect(curvy.twisties).toEqual([expect.objectContaining({ label: 'CV-35', lengthM: 10_000, rating: 4 })])
  })

  it('never rides a one-way road against its direction, however much faster or curvier', () => {
    // The motorway and the mountain road both only run from B to A: going from A to B takes the plain road.
    const graph = graphFixture(
      [
        [0, 0],
        [0.08, 0],
        [0.04, 0.015],
        [0.04, -0.015],
      ],
      [
        { from: 1, to: 0, timeS: 600, lengthM: 9_000, roadClass: RoadClass.Motorway, oneway: OneWay.Yes },
        { from: 1, to: 2, timeS: 400, lengthM: 5_000, funM: 4_500, road: 1, oneway: OneWay.Yes },
        { from: 2, to: 0, timeS: 400, lengthM: 5_000, funM: 4_500, road: 1, oneway: OneWay.Yes },
        { from: 0, to: 3, timeS: 900, lengthM: 9_000 },
        { from: 3, to: 1, timeS: 900, lengthM: 9_000 },
      ],
      ['', 'CV-35'],
    )
    const options = new Planner(graph).plan([[0, 0], [0.08, 0]])
    expect(options.map(({ timeS, twistyM }) => ({ timeS, twistyM }))).toEqual([{ timeS: 1_800, twistyM: 0 }])
    const [back] = new Planner(graph).plan([[0.08, 0], [0, 0]])
    expect(back.timeS).toBe(600)
  })

  it('never joins a leg to a road, or a road to a leg, in a U-turn', () => {
    // The twisty road 1 -> 2 (one-way) runs back the way the carriageway 0 -> 1 came: riding it straight from 0 is a U-turn
    // at 1, however curvy, so neither an appetite route nor a ride through the road as a candidate may go from one to the
    // other there.
    const graph = graphFixture(
      [
        [0, 0],
        [0.01, 0],
        [0, 0.0005],
        [0.02, 0],
        [-0.01, 0],
      ],
      [
        { from: 0, to: 1, timeS: 60, lengthM: 900, oneway: OneWay.Yes },
        { from: 1, to: 2, timeS: 300, lengthM: 5_000, funM: 4_800, road: 1, oneway: OneWay.Yes },
        { from: 1, to: 3, timeS: 60, lengthM: 900 },
        { from: 3, to: 2, timeS: 900, lengthM: 15_000 },
        { from: 4, to: 0, timeS: 60, lengthM: 900 },
      ],
      ['', 'CV-35'],
    )
    const options = new Planner(graph).plan([[0, 0], [0, 0.0005]])
    expect(options.length).toBeGreaterThan(0)
    expect(options.every(({ edges }) => isRideable(graph, 0, edges))).toBe(true)
    expect(options.some(({ edges }) => edges.some((edge, i) => edge === 1 && edges[i - 1] === 0))).toBe(false)
  })

  it('leaves out options beyond the detour budget', () => {
    expect(new Planner(trip()).plan([[0, 0], [0.08, 0]], { maxExtraS: 100 })).toHaveLength(1)
  })

  it('pins the twisty in the Google Maps link', () => {
    const [, curvy] = new Planner(trip()).plan([[0, 0], [0.08, 0]])
    expect(new URL(curvy.googleMapsUrl).searchParams.get('waypoints')?.split('|')).toHaveLength(2)
  })

  it('only rides a track shortcut when the rider asks for tracks', () => {
    //    A ----- B (road)
    //     \     /
    //      track (shorter, curvy)
    const graph = graphFixture(
      [
        [0, 0],
        [0.08, 0],
        [0.04, -0.01],
      ],
      [
        { from: 0, to: 1, timeS: 900, lengthM: 9_000, roadClass: RoadClass.Tertiary },
        { from: 0, to: 2, timeS: 300, lengthM: 4_500, funM: 2_000, roadClass: RoadClass.Track },
        { from: 2, to: 1, timeS: 300, lengthM: 4_500, funM: 2_000, roadClass: RoadClass.Track },
      ],
    )
    const planner = new Planner(graph)
    expect(planner.plan([[0, 0], [0.08, 0]]).map((option) => option.trackM)).toEqual([0])
    const [withTracks] = planner.plan([[0, 0], [0.08, 0]], { includeTracks: true })
    expect(withTracks).toMatchObject({ timeS: 600, trackM: 9_000, twisties: [] })
    expect(withTracks.segments.map((segment) => segment.kind)).toEqual(['track'])
  })

  it('starts and ends on a road even when a track is closer', () => {
    const graph = graphFixture(
      [
        [0, 0],
        [0.01, 0],
        [0.2, 0],
      ],
      [
        { from: 0, to: 1, timeS: 60, roadClass: RoadClass.Track },
        { from: 1, to: 2, timeS: 600, roadClass: RoadClass.Tertiary },
      ],
    )
    const planner = new Planner(graph)
    expect(planner.plan([[0, 0], [0.2, 0]], { includeTracks: true })[0]).toMatchObject({ timeS: 600, trackM: 0 })
  })

  it('offers riding only some of the twisties when one appetite would jump to all of them at once', () => {
    //  A ==== X ==== Y ==== B   motorway, 200 s per stretch
    //   \__/          \__/      twisties, 50 min each and equally rewarding
    const graph = graphFixture(
      [
        [0, 0],
        [0.03, 0],
        [0.06, 0],
        [0.09, 0],
      ],
      [
        { from: 0, to: 1, timeS: 200, roadClass: RoadClass.Motorway },
        { from: 1, to: 2, timeS: 200, roadClass: RoadClass.Motorway },
        { from: 2, to: 3, timeS: 200, roadClass: RoadClass.Motorway },
        { from: 0, to: 1, timeS: 3_000, lengthM: 50_000, funM: 45_000, road: 1 },
        { from: 2, to: 3, timeS: 3_000, lengthM: 50_000, funM: 45_000, road: 2 },
      ],
      ['', 'CV-25', 'CV-20'],
    )
    const options = new Planner(graph).plan([[0, 0], [0.09, 0]])
    expect(options.map((option) => option.timeS)).toEqual([600, 3_400, 6_200])
    expect(options[1].twisties).toHaveLength(1)
  })

  it('tells each twisty segment its rating, and only those', () => {
    const graph = graphFixture(
      [
        [0, 0],
        [0.03, 0],
        [0.06, 0],
      ],
      [
        { from: 0, to: 1, timeS: 200, roadClass: RoadClass.Primary },
        { from: 1, to: 2, timeS: 500, lengthM: 5_000, funM: 4_800, road: 1 },
      ],
      ['', 'CV-25'],
    )
    const ride = new Planner(graph).plan([[0, 0], [0.06, 0]]).at(-1)
    expect(ride?.segments.map(({ kind, rating }) => [kind, rating])).toEqual([
      ['transit', undefined],
      ['twisty', ride?.twisties[0].rating],
    ])
    expect(ride?.twisties[0].rating).toBeGreaterThan(1)
  })
})
