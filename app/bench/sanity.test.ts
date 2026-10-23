import { describe, expect, it } from 'vitest'
import type { TripChecks } from './checks'
import type { TripResult } from './results'
import { checkRows, tripViolations, worstTrips } from './sanity'
import type { BenchTrip } from './trips'

const quiet: TripChecks = {
  backtrackM: [0, 0], revisited: [0, 0], fastestDetour: 1.1, transitPerTwistyKm: [null, 0], fastestKmh: null, slowDullExtraM: [0, 0],
  townsExtra: [0, 0], thinStop: [false, false], sameRoads: [false, false], suspiciousM: [0, 0], timeError: null, regressPerTwistyKm: [null, 0], pinFidelity: {}, straightInTwistyM: [0, 0],
  cityCentreKm: [{}, {}], sideLoops: [[], []], sharpTurns: [0, 0], townWrongWayM: [0, 0], townWrongWaypoints: [0, 0],
}
const result = (id: string, checks: Partial<TripChecks>, defaultStop = 1): TripResult => ({
  id, ms: 1, settled: 1, defaultStop, options: [], greatRoads: {}, checks: { ...quiet, ...checks }, missedTwisties: [], failures: [],
})
const trips = new Map<string, BenchTrip>(['a', 'b', 'c'].map((id) => [id, { id, kind: 'fixed', set: 'tuning', from: [0, 40], to: [0.1, 40], includeTracks: false }]))

describe('sanity checks', () => {
  it('counts the trips and stops that break a check, and those at the default stop', () => {
    const rows = checkRows([result('a', { backtrackM: [0, 900] }), result('b', { backtrackM: [900, 0] }), result('c', {})], trips, null)
    expect(rows.find((row) => row.check === 'R1 backtrackM')).toMatchObject({ trips: 2, stops: 2, atDefaultStop: 1, newTrips: 0, fixedTrips: 0 })
    expect(rows.find((row) => row.check === 'R2 loops')).toMatchObject({ trips: 0 })
  })

  it('tells what is new and what is fixed since the baseline', () => {
    const baseline = new Map([result('a', { backtrackM: [0, 900] }), result('b', {})].map((r) => [r.id, r]))
    const rows = checkRows([result('a', {}), result('b', { backtrackM: [0, 900] })], trips, baseline)
    expect(rows.find((row) => row.check === 'R1 backtrackM')).toMatchObject({ trips: 1, newTrips: 1, fixedTrips: 1 })
  })

  it('flags a twisty that swallows a long dull run, at that stop', () => {
    const found = tripViolations(result('a', { straightInTwistyM: [0, 6_000] }), trips.get('a') as BenchTrip)
    expect(found).toEqual([{ check: 'R14 straightInTwisty', stop: 1 }])
  })

  it('flags a stop that rides more of a city centre than the fastest route, and a loop that buys no fun', () => {
    const city = result('a', { cityCentreKm: [{ Jaén: 1.5 }, { Jaén: 2.6, Cáceres: 0.4 }] })
    expect(tripViolations(city, trips.get('a') as BenchTrip)).toEqual([{ check: 'R16 cityCentre', stop: 1 }])
    const loops = result('a', { sideLoops: [[], [[6, 0, 'A-1'], [10, 4, 'A-2']]] })
    expect(tripViolations(loops, trips.get('a') as BenchTrip)).toEqual([
      { check: 'R17 dominatedLoop', stop: 1 },
      { check: 'R17b lowReturnLoop', stop: 1 },
    ])
  })

  it('has no violations for a trip that did not plan', () => {
    expect(tripViolations({ ...result('a', {}), checks: null }, trips.get('a') as BenchTrip)).toEqual([])
  })

  it('lists the trips with most violations first', () => {
    const worst = worstTrips([result('a', { backtrackM: [900, 900] }), result('b', { backtrackM: [900, 0], revisited: [1, 1] }), result('c', {})], trips)
    expect(worst.map((trip) => trip.id)).toEqual(['b', 'a'])
    expect(worst[0].checks).toEqual(['R1', 'R2'])
  })
})
