import { describe, expect, it } from 'vitest'
import type { Baseline, BaselineHeader } from './baseline'
import { budgetCurve, compare, renderDiff, signTestP, verdict } from './diff'
import type { GreatRoadResult } from './greatRoads'
import type { OptionRecord, TripResult } from './results'
import type { BenchTrip } from './trips'

const option = (extraMin: number, twistyKm: number, routeId = `r${extraMin}-${twistyKm}`, curvyKm = twistyKm): OptionRecord => ({
  timeS: 3_600 + extraMin * 60,
  extraS: extraMin * 60,
  distanceM: 100_000,
  curvyM: curvyKm * 1_000,
  twistyM: twistyKm * 1_000,
  benchTwistyM: twistyKm * 1_000,
  motorwayM: 0,
  trackM: 0,
  otherM: 0,
  twisties: twistyKm > 0 ? [[`R-${twistyKm}`, twistyKm * 1_000, 3]] : [],
  pins: 0,
  routeId,
  presentation: `p-${routeId}`,
})
const pair = (foundAt: number | null, demanded = true): GreatRoadResult => ({ deadEnd: false, costS: 600, demanded, foundAt, lastRides: false, costRatio: null })
const result = (id: string, options: OptionRecord[], greatRoads: TripResult['greatRoads'] = {}): TripResult => ({
  id,
  ms: 100,
  settled: 1_000,
  defaultStop: 0,
  options,
  greatRoads,
  checks: null,
  missedTwisties: [],
  failures: [],
})
const header = (dataHash = 'data'): BaselineHeader => ({
  commit: 'abc',
  dataHash,
  data: { source: 'x.pbf', nodes: 1, edges: 1 },
  tripsHash: 't',
  roadsHash: 'r',
  createdAt: '2026-10-14T00:00:00Z',
  roads: { 'road-a': { located: true, deadEnd: false } },
  accepted: [],
})
const trip = (id: string, set: 'tuning' | 'holdout' = 'tuning'): BenchTrip => ({ id, kind: 'fixed', set, from: [0, 0], to: [1, 1], includeTracks: false })
const baselineOf = (...results: TripResult[]): Baseline => ({ header: header(), results: new Map(results.map((r) => [r.id, r])) })

describe('budget curves', () => {
  it('takes the best option within each extra-time budget', () => {
    const options = [option(0, 0), option(20, 5), option(70, 12)]
    expect(budgetCurve(options, (o) => o.benchTwistyM)).toEqual([0, 0, 5_000, 5_000, 5_000, 12_000, 12_000, 12_000])
  })

  it('judges the budgets that moved by at least a km and 5 %', () => {
    const base = [0, 0, 5_000, 5_000, 5_000, 12_000, 12_000, 12_000]
    expect(verdict(base, base)).toBe('unchanged')
    expect(verdict(base, base.map((value) => value + 500))).toBe('unchanged')
    expect(verdict(base, base.map((value, i) => (i === 5 ? value + 2_000 : value)))).toBe('improved')
    expect(verdict(base, base.map((value, i) => (i === 5 ? value - 2_000 : value)))).toBe('worsened')
    expect(verdict(base, base.map((value, i) => (i === 2 ? value + 2_000 : i === 5 ? value - 2_000 : value)))).toBe('mixed')
  })

  it('does not call a change of 1 km on a long ride a change at 5 %', () => {
    expect(verdict([100_000], [101_000])).toBe('unchanged')
    expect(verdict([100_000], [105_000])).toBe('improved')
  })
})

describe('sign test', () => {
  it('is certain of nothing without changes and when changes split evenly', () => {
    expect(signTestP(0, 0)).toBe(1)
    expect(signTestP(5, 5)).toBe(1)
  })

  it('finds a lopsided split unlikely by chance', () => {
    expect(signTestP(10, 0)).toBeCloseTo(0.00195, 4)
    expect(signTestP(0, 10)).toBeCloseTo(0.00195, 4)
    expect(signTestP(8, 2)).toBeCloseTo(0.109, 3)
  })
})

describe('compare', () => {
  const trips = [trip('a'), trip('b', 'holdout'), trip('c')]
  const same = () => baselineOf(result('a', [option(0, 0), option(30, 6)]), result('b', [option(0, 0), option(30, 6)]))

  it('calls a run identical when every route is', () => {
    const diff = compare(same(), { header: header(), results: [result('a', [option(0, 0), option(30, 6)]), result('b', [option(0, 0), option(30, 6)])] }, trips, true)
    expect(diff.identical).toEqual(['a', 'b'])
    expect(diff.failures).toEqual([])
  })

  it('separates routes that only look different from routes that are different', () => {
    const shown = { ...option(30, 6), presentation: 'other' }
    const diff = compare(same(), { header: header(), results: [result('a', [option(0, 0), shown]), result('b', [option(0, 0), option(30, 9)])] }, trips, false)
    expect(diff.presentationOnly).toEqual(['a'])
    expect(diff.changed).toEqual(['b'])
  })

  it('fails --expect identical on a changed route, and on other data', () => {
    const now = { header: header('other'), results: [result('a', [option(0, 0), option(30, 9)]), result('b', [option(0, 0), option(30, 6)])] }
    const diff = compare(same(), now, trips, true)
    expect(diff.failures).toEqual(expect.arrayContaining([expect.stringMatching(/data hash differs/), expect.stringMatching(/a has different routes/)]))
    expect(compare(same(), now, trips, false).failures).toEqual([])
  })

  it('counts improved and worsened trips per set, and leaves the fun score unjudged on other data', () => {
    const now = { header: header(), results: [result('a', [option(0, 0), option(30, 9)]), result('b', [option(0, 0), option(30, 2)])] }
    const diff = compare(same(), now, trips, false)
    expect(diff.twistyKm.tuning.improved).toEqual(['a'])
    expect(diff.twistyKm.holdout.worsened).toEqual(['b'])
    expect(diff.curvy?.tuning.improved).toEqual(['a'])
    expect(compare(same(), { ...now, header: header('other') }, trips, false).curvy).toBeNull()
  })

  it('lists roads gained and lost by name', () => {
    const now = { header: header(), results: [result('a', [option(0, 0), option(30, 9)]), result('b', [option(0, 0), option(30, 6)])] }
    expect(compare(same(), now, trips, false).roads).toEqual([
      { label: 'R-9', tripsGained: 1, tripsLost: 0, kmGained: 9, kmLost: 0 },
      { label: 'R-6', tripsGained: 0, tripsLost: 1, kmGained: 0, kmLost: 6 },
    ])
  })

  it('fails when a great road that was found is not any more, and reports one that is newly found', () => {
    const before = baselineOf(result('a', [option(0, 0)], { 'road-a': pair(1) }), result('b', [option(0, 0)], { 'road-a': pair(null) }))
    const now = { header: header(), results: [result('a', [option(0, 0)], { 'road-a': pair(null) }), result('b', [option(0, 0)], { 'road-a': pair(2) })] }
    const diff = compare(before, now, trips, false)
    expect(diff.greatRoads.lost).toEqual([{ road: 'road-a', trip: 'a' }])
    expect(diff.greatRoads.gained).toEqual([{ road: 'road-a', trip: 'b' }])
    expect(diff.greatRoads.recall.tuning).toEqual({ before: [1, 1], now: [0, 1] })
    expect(diff.failures).toEqual([expect.stringMatching(/G1 loss: road-a/)])
  })

  it('does not count a road as lost when it is no longer demanded of the trip', () => {
    const before = baselineOf(result('a', [option(0, 0)], { 'road-a': pair(1) }))
    const now = { header: header(), results: [result('a', [option(0, 0)], { 'road-a': pair(null, false) })] }
    expect(compare(before, now, trips, false).failures).toEqual([])
  })

  it('fails when a located road is not any more', () => {
    const now = { header: { ...header(), roads: { 'road-a': { located: false, deadEnd: false } } }, results: [result('a', [option(0, 0)])] }
    expect(compare(same(), now, trips, false).failures).toEqual([expect.stringMatching(/G2 unlocatable: road-a/)])
  })

  it('names the roads the list no longer has, instead of silently dropping them', () => {
    const now = { header: { ...header(), roads: {} }, results: [result('a', [option(0, 0)])] }
    const diff = compare(same(), now, trips, false)
    expect(diff.greatRoads.removed).toEqual(['road-a'])
    expect(renderDiff(diff, same().header).join('\n')).toContain('No longer in the list (renamed or dropped, so not compared): `road-a`.')
  })

  it('names new and removed trips', () => {
    const now = { header: header(), results: [result('a', [option(0, 0), option(30, 6)]), result('c', [option(0, 0)])] }
    const diff = compare(same(), now, trips, false)
    expect(diff.newTrips).toEqual(['c'])
    expect(diff.removedTrips).toEqual(['b'])
  })
})
