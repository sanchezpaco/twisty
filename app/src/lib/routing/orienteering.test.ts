import { describe, expect, it } from 'vitest'
import { chainsOfRoads, type Leg, type PoolRoad } from './orienteering'

// The fastest ride takes an hour. Road 0 and road 1 (each 10 min, 9 km of fun) lie near the start, 10 minutes apart; road 2
// (5 km) is the other way round of road 1.
const pool: PoolRoad[] = [
  { road: 0, rideS: 600, funM: 9_000, approachS: 600, departureS: 3_000 },
  { road: 1, rideS: 600, funM: 9_000, approachS: 1_200, departureS: 2_700 },
  { road: 1, rideS: 600, funM: 5_000, approachS: 1_500, departureS: 2_400 },
]
const legs: Map<number, Leg>[] = [
  new Map([
    [1, { timeS: 600, funM: 1_000 }],
    [2, { timeS: 300, funM: 0 }],
  ]),
  new Map(),
  new Map(),
]
const settings = { fastestS: 3_600, rangeS: 3 * 3_600, stepS: 300, maxPasses: 2 }

describe('chainsOfRoads', () => {
  it('chains the roads a larger budget fits, each candidate once', () => {
    const chains = chainsOfRoads(pool, legs, settings)
    // Road 2 first, for its fun per second; then the larger budget swaps it for road 1, the same candidate the other way.
    expect(chains.map((chain) => chain.roads)).toEqual([[0], [0, 2], [0, 1]])
    expect(chains[2]).toEqual({ roads: [0, 1], timeS: 600 + 600 + 600 + 600 + 2_700, funM: 19_000 })
  })

  it('does not chain roads with no leg between them', () => {
    expect(chainsOfRoads(pool, pool.map(() => new Map()), settings).map((chain) => chain.roads)).toEqual([[0]])
  })

  it('keeps only chains that no other beats on time and fun, fastest first', () => {
    const chains = chainsOfRoads(pool, legs, settings)
    chains.slice(1).forEach((chain, i) => {
      expect(chain.timeS).toBeGreaterThan(chains[i].timeS)
      expect(chain.funM).toBeGreaterThan(chains[i].funM)
    })
  })
})
