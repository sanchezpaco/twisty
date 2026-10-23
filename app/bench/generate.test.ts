import { describe, expect, it } from 'vitest'
import type { Twisty } from '../src/lib/data/twisties'
import { haversineM, type LonLat } from '../src/lib/geo'
import { bearingDeg, destination, distanceToLineKm, greatTripSet, HOLDOUT_PERCENT, mountainKm, splitOf } from './generate'
import type { KnownRoad } from './roads'
import { fnv1a, mulberry32 } from './random'

describe('seeded randomness', () => {
  it('gives the same numbers for the same trip id, whatever other trips exist', () => {
    const [first, again, other] = [mulberry32(fnv1a('20261013:regional-001')), mulberry32(fnv1a('20261013:regional-001')), mulberry32(fnv1a('20261013:regional-002'))]
    const sequence = (random: () => number) => [random(), random(), random()]
    expect(sequence(first)).toEqual(sequence(again))
    expect(sequence(mulberry32(fnv1a('20261013:regional-001')))).not.toEqual(sequence(other))
  })

  it('spreads numbers over [0, 1)', () => {
    const random = mulberry32(7)
    const draws = Array.from({ length: 1000 }, random)
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...draws)).toBeLessThan(1)
    expect(draws.reduce((a, b) => a + b, 0) / draws.length).toBeCloseTo(0.5, 1)
  })

  it('holds out about a third of the cells, always the same ones', () => {
    const keys = Array.from({ length: 400 }, (_, i) => `cell:${i}:42`)
    const held = keys.filter((key) => splitOf(key) === 'holdout').length
    expect(held / keys.length).toBeCloseTo(HOLDOUT_PERCENT / 100, 1)
    expect(splitOf('cell:-1:42')).toBe(splitOf('cell:-1:42'))
  })

  it('puts the trips of a road added after the tuning in the holdout, whatever their cell', () => {
    const tuningCell = Array.from({ length: 50 }, (_, i) => `cell:${i}:42`).find((key) => splitOf(key) === 'tuning')!
    const road = (addedOn: string) => ({ id: 'road', region: 'r', from: [0, 0], to: [1, 1], why: '', addedBy: 'scout', addedOn }) as KnownRoad
    expect(greatTripSet(road('2026-10-19'), '2026-10-18', tuningCell)).toBe('holdout')
    expect(greatTripSet(road('2026-10-18'), '2026-10-18', tuningCell)).toBe('tuning')
    expect(greatTripSet(road('2026-10-19'), null, tuningCell)).toBe('tuning')
  })
})

describe('geometry of the generator', () => {
  it('moves a point by a distance along a bearing', () => {
    const start: LonLat = [-3, 40]
    expect(haversineM(start, destination(start, 90, 100)) / 1000).toBeCloseTo(100, 0)
    expect(destination(start, 0, 111.32)[1]).toBeCloseTo(41, 3)
    expect(destination(start, 180, 111.32)[1]).toBeCloseTo(39, 3)
  })

  it('measures the bearing of a line, clockwise from north', () => {
    const start: LonLat = [-3, 40]
    expect(bearingDeg(start, destination(start, 90, 50))).toBeCloseTo(90, 0)
    expect(bearingDeg(start, destination(start, 225, 50))).toBeCloseTo(225, 0)
    expect(bearingDeg(start, destination(start, 0, 50))).toBeCloseTo(0, 0)
  })

  it('measures the distance from a point to a segment, past its ends too', () => {
    const [a, b]: [LonLat, LonLat] = [[0, 40], [1, 40]]
    expect(distanceToLineKm([0.5, 40.1], a, b)).toBeCloseTo(11.1, 0)
    expect(distanceToLineKm([2, 40], a, b)).toBeGreaterThan(80)
  })

  it('adds up the well-rated twisties near the line and no others', () => {
    const twisty = (rating: number, lat: number): Twisty => ({
      id: 0, name: null, ref: null, lengthM: 10_000, twist: 200, rating, line: [[0.4, lat], [0.6, lat]],
    })
    const twisties = [twisty(4, 40.05), twisty(2, 40.05), twisty(5, 40.5), twisty(3, 40.1)]
    expect(mountainKm(twisties, [0, 40], [1, 40])).toBe(20)
  })
})
