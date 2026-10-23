import { describe, expect, it } from 'vitest'
import { haversineM, type LonLat } from '../src/lib/geo'
import type { RideOption } from '../src/lib/routing/ride'
import { graphFixture } from '../src/lib/testing/graphFixture'
import { violations } from './checks'
import { NO_TWISTY_GAIN, tripChecks } from './tripChecks'
import { optionRecord } from './results'
import { PlaceIndex } from './metrics'
import type { BenchTrip } from './trips'

//  A -- B -- C        main road (edges 0, 1), 10 km each
//   \_______/         the twisty way (edge 2), 30 km of curves; edge 3 is an out-and-back spur on B
const graph = graphFixture(
  [[0, 40], [0.1, 40], [0.2, 40], [0.1, 40.05]],
  [
    { from: 0, to: 1, timeS: 600, lengthM: 10_000 },
    { from: 1, to: 2, timeS: 600, lengthM: 10_000 },
    { from: 0, to: 2, timeS: 2_400, lengthM: 30_000, funM: 27_000 },
    { from: 1, to: 3, timeS: 300, lengthM: 4_000 },
  ],
)
const trip: BenchTrip = { id: 't', kind: 'fixed', set: 'tuning', from: [0, 40], to: [0.2, 40], includeTracks: false }
const option = (edges: number[], timeS: number, distanceM: number, twistyM = 0, label = 'CV-1'): RideOption =>
  ({
    edges,
    timeS,
    extraS: timeS - 1_200,
    distanceM,
    curvyM: twistyM,
    twistyM,
    motorwayM: 0,
    trackM: 0,
    otherM: distanceM - twistyM,
    twisties: twistyM > 0 ? [{ label, lengthM: twistyM, rating: 4, narrowM: 0, postedKmh: null, fordCount: 0, line: [[0, 40], [0.2, 40]] as LonLat[], leg: 0 }] : [],
    segments: [],
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1',
    pinnedAll: true,
    legs: [{ timeS, distanceM, twistyM, curvyM: twistyM }],
    coverageRoad: null,
  }) as RideOption
const checksFor = (options: RideOption[], tripOverride: Partial<BenchTrip> = {}) =>
  tripChecks(graph, { ...trip, ...tripOverride }, options, options.map((o) => optionRecord(graph, o)), 0, [0], { places: new PlaceIndex([[0.1, 40.01], [0.15, 40.01]]) })

describe('tripChecks', () => {
  const fastest = option([0, 1], 1_200, 20_000)
  const twisty = option([2], 2_400, 30_000, 30_000)

  it('measures what a stop adds over the fastest, per twisty km', () => {
    const checks = checksFor([fastest, twisty])
    expect(checks.transitPerTwistyKm).toEqual([null, 0])
    expect(checks.thinStop).toEqual([false, false])
    expect(checks.sameRoads).toEqual([false, false])
    expect(checks.backtrackM).toEqual([0, 0])
    expect(checks.revisited).toEqual([0, 0])
    expect(checks.fastestDetour).toBeCloseTo(20_000 / haversineM(trip.from, trip.to), 5)
  })

  it('finds a stop that buys no twisty km and rides a spur twice', () => {
    const spur = option([0, 3, 3, 1], 2_400, 28_000)
    const checks = checksFor([fastest, spur])
    expect(checks.backtrackM).toEqual([0, 4_000])
    expect(checks.revisited).toEqual([0, 1])
    expect(checks.transitPerTwistyKm[1]).toBe(NO_TWISTY_GAIN)
    expect(checks.thinStop[1]).toBe(true)
    expect(checks.sameRoads[1]).toBe(true)
    expect(checks.regressPerTwistyKm[1]).toBe(NO_TWISTY_GAIN)
  })

  it('counts the places a stop passes that the fastest does not, and the time against a reference', () => {
    const checks = checksFor([fastest, twisty], { referenceTimeS: 1_000 })
    expect(checks.townsExtra[0]).toBe(0)
    expect(checks.timeError).toBeCloseTo(0.2)
  })

  it('judges speed only on trips of 100 km or more', () => {
    expect(checksFor([fastest]).fastestKmh).toBeNull()
    const far = { to: [1.5, 40] as LonLat }
    expect(checksFor([fastest], far).fastestKmh).toBeCloseTo(60)
  })

  it('has no pin fidelity without the tools to route', () => {
    expect(checksFor([fastest, twisty]).pinFidelity).toEqual({ 0: null })
  })
})

describe('violations', () => {
  const clean = checksFor([option([0, 1], 1_200, 20_000)])

  it('reports nothing for a quiet trip', () => {
    expect(violations(clean, 1, 21, false)).toEqual([])
  })

  it('flags the numbers over their thresholds, by stop or for the trip', () => {
    const found = violations({ ...clean, backtrackM: [0, 800], fastestDetour: 2, pinFidelity: { 0: 0.5, 1: 0.95 } }, 3, 200, false)
    expect(found).toEqual(
      expect.arrayContaining([
        { check: 'R1 backtrackM', stop: 1 },
        { check: 'R3 fastestDetour', stop: null },
        { check: 'R13 pinFidelity', stop: 0 },
      ]),
    )
    expect(found.some((violation) => violation.check === 'R13 pinFidelity' && violation.stop === 1)).toBe(false)
  })

  it('flags a slider with two stops or fewer where more are expected, but only on a long enough trip', () => {
    expect(violations(clean, 2, 120, true)).toEqual([{ check: 'R9 emptySlider', stop: null }])
    expect(violations(clean, 2, 30, true)).toEqual([])
    expect(violations(clean, 2, 120, false)).toEqual([])
  })
})
