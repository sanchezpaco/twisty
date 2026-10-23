import { describe, expect, it } from 'vitest'
import { chooseStops, type LadderRide, type SliderSettings } from './slider'

const ride = (minutes: number, funKm: number, twistyKm = funKm, greatRoads: number[] = []): LadderRide => ({
  timeS: 3_600 + minutes * 60,
  score: funKm * 1_000,
  twistyM: twistyKm * 1_000,
  greatRoads,
})
const settings = (overrides: Partial<SliderSettings> = {}): SliderSettings => ({
  fastestS: 3_600,
  rangeS: 180 * 60,
  maxStops: 9,
  stopWorth: 500,
  greatRoadWeight: 0,
  greatRoadFunM: [],
  ...overrides,
})
const minutesOf = (stops: LadderRide[]) => stops.map((stop) => (stop.timeS - 3_600) / 60)

describe('chooseStops', () => {
  it('starts with the fastest ride and climbs in time, fun and twisty km', () => {
    const { stops } = chooseStops([ride(0, 0), ride(30, 20), ride(60, 15), ride(90, 40, 10), ride(120, 60)], settings())
    expect(minutesOf(stops)).toEqual([0, 30, 120])
  })

  it('shows only the fastest ride when no other one is worth a stop', () => {
    expect(minutesOf(chooseStops([ride(0, 0), ride(170, 1)], settings()).stops)).toEqual([0])
  })

  it('keeps one of two rides that differ by little', () => {
    const { stops } = chooseStops([ride(0, 0), ride(40, 30), ride(42, 31), ride(120, 70)], settings({ stopWorth: 2_000 }))
    expect(minutesOf(stops)).toEqual([0, 42, 120])
  })

  it('shows no more stops than the slider holds', () => {
    const rides = [ride(0, 0), ...Array.from({ length: 20 }, (_, i) => ride((i + 1) * 8, (i + 1) * 5))]
    expect(chooseStops(rides, settings({ stopWorth: 0, maxStops: 5 })).stops).toHaveLength(5)
  })

  it('puts a great road on the slider when its fun is worth the stop it takes', () => {
    // The ride of the great road (index 0, 20 km of fun) is dominated: slower than the 60-minute ride and with less fun.
    const rides = [ride(0, 0), ride(60, 50), ride(70, 45, 52, [0]), ride(150, 90)]
    const none = chooseStops(rides, settings({ greatRoadFunM: [20_000] }))
    expect(minutesOf(none.stops)).toEqual([0, 60, 150])
    const weighted = chooseStops(rides, settings({ greatRoadFunM: [20_000], greatRoadWeight: 1 }))
    expect(minutesOf(weighted.stops)).toEqual([0, 70, 150])
    expect(weighted.addedFor).toEqual([null, 0, null])
  })

  it('finds the ladder of most expected fun, as trying every ladder does', () => {
    let seed = 7
    const random = () => ((seed = (seed * 16_807) % 2_147_483_647) / 2_147_483_647)
    for (let trial = 0; trial < 30; trial++) {
      const rides = [ride(0, 0), ...Array.from({ length: 9 }, () => ride(Math.round(random() * 170) + 1, Math.round(random() * 80), Math.round(random() * 80)))]
      const options = settings({ maxStops: 4, stopWorth: 1_000 })
      const value = (stops: LadderRide[]) =>
        stops.reduce((sum, stop, i) => sum + (stop.score * ((i + 1 < stops.length ? stops[i + 1].timeS : 3_600 + 180 * 60) - stop.timeS)) / (180 * 60), 0) -
        1_000 * (stops.length - 1)
      const sorted = [...rides].sort((a, b) => a.timeS - b.timeS || b.score - a.score)
      let best = -Infinity
      for (let mask = 0; mask < 1 << (sorted.length - 1); mask++) {
        const stops = [sorted[0], ...sorted.slice(1).filter((_, i) => mask & (1 << i))]
        const climbing = stops.every((stop, i) => i === 0 || (stop.timeS > stops[i - 1].timeS && stop.score > stops[i - 1].score && stop.twistyM > stops[i - 1].twistyM))
        if (climbing && stops.length <= 4) best = Math.max(best, value(stops))
      }
      expect(value(chooseStops(rides, options).stops)).toBeCloseTo(best, 6)
    }
  })
})
