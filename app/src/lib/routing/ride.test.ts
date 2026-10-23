import { describe, expect, it } from 'vitest'
import { EdgeFlag, OneWay } from '../data/graph'
import { graphFixture } from '../testing/graphFixture'
import { listedTwisties } from '../curves'
import { buildRideOption, twistyStretches } from './ride'

// Two curvy runs of one road with a straight bit of `gapM` between them.
const roadWithGap = (gapM: number) =>
  graphFixture(
    [
      [0, 0],
      [0.05, 0],
      [0.1, 0],
    ],
    [
      { from: 0, to: 1, timeS: 300, lengthM: 4_000, funM: 3_600, road: 1 },
      { from: 1, to: 2, timeS: 300, lengthM: gapM, funM: 0, road: 1 },
      { from: 2, to: 3, timeS: 300, lengthM: 4_000, funM: 3_600, road: 1 },
    ],
    ['', 'N-322'],
  )

describe('twistyStretches', () => {
  it('reads two runs of one road across a short straight as a single twisty', () => {
    expect(twistyStretches(roadWithGap(2_500), [0, 1, 2])).toEqual([[0, 2]])
  })

  it('keeps two runs of one road apart across a long straight', () => {
    expect(twistyStretches(roadWithGap(40_000), [0, 1, 2])).toEqual([
      [0, 0],
      [2, 2],
    ])
  })
})

describe('the narrow and signed parts of a twisty', () => {
  // A twisty of 6 km in two edges, then a straight.
  type Tags = { narrow?: number; postedKmh?: number; fords?: number; flags?: number }
  const graph = (first: Tags, second: Tags) =>
    graphFixture(
      [
        [0, 0],
        [0.03, 0],
        [0.06, 0],
      ],
      [
        { from: 0, to: 1, timeS: 400, lengthM: 3_000, funM: 2_700, road: 1, ...first },
        { from: 1, to: 2, timeS: 400, lengthM: 3_000, funM: 2_700, road: 1, ...second },
      ],
      ['', 'GIV-5221'],
    )
  const ride = (g: ReturnType<typeof graph>) =>
    buildRideOption({ graph: g, points: [[0, 0], [0.06, 0]], start: 0, edges: [0, 1], fastestS: 0 }).twisties[0]

  it('adds up the metres on narrow ways', () => {
    expect(ride(graph({ narrow: 255 }, { narrow: 128 })).narrowM).toBeCloseTo(3_000 + 1_506, 0)
  })

  it('tells the lowest limit posted on at least a kilometre', () => {
    expect(ride(graph({ postedKmh: 40 }, { postedKmh: 30 })).postedKmh).toBe(30)
    expect(ride(graph({ postedKmh: 40 }, {})).postedKmh).toBe(40)
  })

  it('says nothing of a road that is not signed or narrow', () => {
    expect(ride(graph({}, {}))).toMatchObject({ narrowM: 0, postedKmh: null, fordCount: 0 })
  })

  it('counts the fords on it', () => {
    expect(ride(graph({ fords: 1 }, { fords: 2 })).fordCount).toBe(3)
  })

  it('tells when some of it closes part of the year', () => {
    expect(ride(graph({}, { flags: EdgeFlag.ClosedPartOfYear })).closedPartOfYear).toBe(true)
    expect(ride(graph({ flags: EdgeFlag.BuiltUp }, {})).closedPartOfYear).toBe(false)
    expect(ride(graph({ flags: EdgeFlag.ClosedPartOfYear | EdgeFlag.BuiltUp }, {})).closedPartOfYear).toBe(false)
  })
})

describe('what the whole ride tells the rider', () => {
  // A twisty of 6 km, then 3 km of straight with two fords and a stretch closed in winter.
  const g = graphFixture(
    [
      [0, 0],
      [0.03, 0],
      [0.06, 0],
      [0.09, 0],
    ],
    [
      { from: 0, to: 1, timeS: 400, lengthM: 3_000, funM: 2_700, road: 1, fords: 1 },
      { from: 1, to: 2, timeS: 400, lengthM: 3_000, funM: 2_700, road: 1 },
      { from: 2, to: 3, timeS: 100, lengthM: 3_000, road: 2, fords: 2, flags: EdgeFlag.ClosedPartOfYear },
    ],
    ['', 'GIV-5221', 'CV-345'],
  )
  const option = buildRideOption({ graph: g, points: [[0, 0], [0.09, 0]], start: 0, edges: [0, 1, 2], fastestS: 0 })

  it('counts the fords off the twisties too, and the closures', () => {
    expect(option.twisties.map((twisty) => [twisty.fordCount, twisty.closedPartOfYear])).toEqual([[1, false]])
    expect(option).toMatchObject({ fordCount: 3, closedPartOfYear: true, closedRoads: ['CV-345'] })
  })
})

describe('the roads of a ride that close part of the year', () => {
  // Ma-2210 under two names, an unnamed lane and a town's street, all closed some days of the year.
  const closed = EdgeFlag.ClosedPartOfYear
  const g = graphFixture(
    [0, 1, 2, 3, 4].map((i) => [i * 0.01, 0] as [number, number]),
    [
      { from: 0, to: 1, timeS: 60, lengthM: 900, road: 4, flags: closed | EdgeFlag.BuiltUp },
      { from: 1, to: 2, timeS: 60, lengthM: 900, road: 1, flags: closed },
      { from: 2, to: 3, timeS: 60, lengthM: 300, road: 2, flags: closed },
      { from: 3, to: 4, timeS: 60, lengthM: 900, road: 0, flags: closed },
    ],
    ['', 'Ma-2210 · Carretera de Formentor', 'Ma-2210 · Túnel de Formentor', 'Ma-10', 'Avinguda de Gregorio Gea'],
  )
  const option = buildRideOption({ graph: g, points: [[0, 0], [0.04, 0]], start: 0, edges: [0, 1, 2, 3], fastestS: 0 })

  it('names each road once by its main label, and leaves out unnamed ones and towns', () => {
    expect(option.closedRoads).toEqual(['Ma-2210 · Carretera de Formentor'])
    expect(option.closedPartOfYear).toBe(true)
  })
})

describe('the roads of a twisty chained across several', () => {
  // One twisty along six edges: AV-901 with a named bridge of it, an unnamed lane, a short bit of N-502, then AV-P-711.
  const pieces: [road: number, lengthM: number][] = [
    [1, 4_000],
    [2, 300],
    [0, 5_000],
    [3, 500],
    [4, 3_000],
  ]
  const g = graphFixture(
    pieces.map((_, i) => [i * 0.03, 0] as [number, number]).concat([[pieces.length * 0.03, 0]]),
    pieces.map(([road, lengthM], i) => ({ from: i, to: i + 1, timeS: lengthM / 15, lengthM, funM: lengthM * 0.9, road })),
    ['', 'AV-901 · Carretera de Ávila', 'AV-901 · Puente del Tiétar', 'N-502', 'AV-P-711'],
  )
  const twisty = buildRideOption({ graph: g, points: [[0, 0], [0.15, 0]], start: 0, edges: [0, 1, 2, 3, 4], fastestS: 0 }).twisties[0]

  it('lists them in riding order, each with its own km, one ref as one road and short pieces in the road they cut', () => {
    expect(twisty.roads).toEqual([
      { label: 'AV-901 · Carretera de Ávila', lengthM: 4_300 },
      { label: '', lengthM: 5_500 },
      { label: 'AV-P-711', lengthM: 3_000 },
    ])
    expect(twisty.lengthM).toBe(12_800)
  })

  it('is named after its longest named road, never the unnamed one', () => {
    expect(twisty.label).toBe('AV-901 · Carretera de Ávila')
  })
})

describe('the Google Maps pins of a ride', () => {
  // A long twisty through a village whose one-way street runs from node `from` to node `to`.
  const throughVillage = (from: number, to: number) =>
    graphFixture(
      [
        [0, 0],
        [8 / 111.195, 0],
        [8.8 / 111.195, 0],
        [16.8 / 111.195, 0],
      ],
      [
        { from: 0, to: 1, timeS: 500, lengthM: 8_000, funM: 7_200, road: 1 },
        { from, to, timeS: 100, lengthM: 800, funM: 0, road: 1, oneway: OneWay.InTown },
        { from: 2, to: 3, timeS: 500, lengthM: 8_000, funM: 7_200, road: 1 },
      ],
      ['', 'A-373'],
    )
  const pinnedKm = (graph: ReturnType<typeof throughVillage>) => {
    const { googleMapsUrl } = buildRideOption({ graph, points: [[0, 0], [16.8 / 111.195, 0]], start: 0, edges: [0, 1, 2], fastestS: 0 })
    return new URL(googleMapsUrl).searchParams.get('waypoints')!.split('|').map((pin) => Number(pin.split(',')[1]) * 111.195)
  }

  it('keeps them off a town one-way ridden against its way', () => {
    const [, interior] = pinnedKm(throughVillage(2, 1))
    expect(interior < 8 - 0.029 || interior > 8.8 + 0.029).toBe(true)
  })

  it('may pin a town one-way ridden its own way', () => {
    expect(pinnedKm(throughVillage(1, 2))[1]).toBeCloseTo(8.4, 1)
  })
})

describe('the road an option was added for', () => {
  // A twisty of 8 km on BP-1241 that goes on for 4 km on B-124, a straight of 4 km, and BP-1241 again; the option was
  // added for the B-124 stretch alone.
  const graph = graphFixture(
    [0, 8, 12, 16, 24].map((km): [number, number] => [km / 111.195, 0]),
    [
      { from: 0, to: 1, timeS: 500, lengthM: 8_000, funM: 7_200, road: 1 },
      { from: 1, to: 2, timeS: 250, lengthM: 4_000, funM: 3_600, road: 2 },
      { from: 2, to: 3, timeS: 200, lengthM: 4_000, funM: 0, road: 3 },
      { from: 3, to: 4, timeS: 500, lengthM: 8_000, funM: 7_200, road: 1 },
    ],
    ['', 'BP-1241', 'B-124', 'N-141'],
  )
  const option = (edges: number[], addedRoad?: number[]) =>
    buildRideOption({ graph, points: [[0, 0], [24 / 111.195, 0]], start: 0, edges, fastestS: 0, addedRoad })

  it('is the twisty that rides it, named as that twisty, which the summary lists first', () => {
    const added = option([0, 1, 2, 3], [1])
    expect(added.twisties.map((twisty) => twisty.label)).toEqual(['BP-1241', 'BP-1241'])
    expect(added).toMatchObject({ coverageRoad: 'BP-1241', coverageTwisty: 0 })
    expect(listedTwisties(added.twisties, added.coverageRoad, added.coverageTwisty)[0]).toMatchObject({ number: 1, added: true })
  })

  it('is told apart from another twisty of the same name', () => {
    const added = option([0, 1, 2, 3], [3])
    expect(added).toMatchObject({ coverageRoad: 'BP-1241', coverageTwisty: 1 })
    expect(listedTwisties(added.twisties, added.coverageRoad, added.coverageTwisty)[0]).toMatchObject({ number: 2, added: true })
  })

  it('is none for an option the slider chose alone', () => {
    expect(option([0, 1, 2, 3])).toMatchObject({ coverageRoad: null })
    expect(option([0, 1, 2, 3]).coverageTwisty).toBeUndefined()
  })
})

describe('a ride through the rider’s stops', () => {
  // Edges of 4 km along the equator, from node i to node i + 1; the curvy ones are twisties of their own.
  const KM = 1 / 111.195
  const line = (curvy: boolean[]) =>
    graphFixture(
      Array.from({ length: curvy.length + 1 }, (_, i): [number, number] => [i * 4 * KM, 0]),
      curvy.map((isCurvy, i) => ({ from: i, to: i + 1, timeS: 240, lengthM: 4_000, funM: isCurvy ? 3_600 : 0, road: isCurvy ? 1 : 2 })),
      ['', 'CV-35', 'A-3'],
    )
  const at = (node: number): [number, number] => [node * 4 * KM, 0]
  const ride = (curvy: boolean[], stops: number[]) =>
    buildRideOption({
      graph: line(curvy),
      points: [at(0), ...stops.map(at), at(curvy.length)],
      start: 0,
      edges: curvy.map((_, i) => i),
      legEnds: [...stops, curvy.length],
      fastestS: 0,
    })

  it('gives each leg its share, and the legs add up to the whole ride', () => {
    const option = ride([true, false, true, false, true, false], [3])
    expect(option.twisties.map((twisty) => twisty.leg)).toEqual([0, 0, 1])
    expect(option.legs).toEqual([
      { timeS: 720, distanceM: 12_000, twistyM: 8_000, curvyM: 7_200 },
      { timeS: 720, distanceM: 12_000, twistyM: 4_000, curvyM: 3_600 },
    ])
    for (const key of ['timeS', 'distanceM', 'twistyM', 'curvyM'] as const) expect(option.legs[0][key] + option.legs[1][key]).toBe(option[key])
  })

  it('ends a twisty at a stop', () => {
    expect(ride([true, true], []).twisties.map((twisty) => twisty.lengthM)).toEqual([8_000])
    expect(ride([true, true], [1]).twisties.map((twisty) => [twisty.lengthM, twisty.leg])).toEqual([
      [4_000, 0],
      [4_000, 1],
    ])
  })

  it('sends Google Maps through every stop in order, between the pins of the legs around it', () => {
    const waypoints = new URL(ride([true, false, true, false], [2]).googleMapsUrl).searchParams.get('waypoints')!.split('|')
    const km = waypoints.map((pin) => Number(pin.split(',')[1]) / KM)
    expect(km.map(Math.round)).toEqual([0, 4, 8, 8, 12])
    expect(waypoints[2]).toBe(`0.00000,${(8 * KM).toFixed(5)}`)
  })

  it('pins every twisty end to end while the waypoints left by the stops allow it, and says when not', () => {
    const curvy = [true, false, true, false, true, false, true, false]
    expect(ride(curvy, []).pinnedAll).toBe(true)
    const capped = ride(curvy, [1, 3, 5])
    expect(capped.pinnedAll).toBe(false)
    expect(new URL(capped.googleMapsUrl).searchParams.get('waypoints')!.split('|')).toHaveLength(9)
  })
})
