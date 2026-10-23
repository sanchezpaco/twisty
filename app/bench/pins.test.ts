import { describe, expect, it } from 'vitest'
import type { LonLat } from '../src/lib/geo'
import { EdgeWeights } from '../src/lib/routing/edgeWeights'
import { NodeLocator } from '../src/lib/routing/nodeLocator'
import { ShortestPaths } from '../src/lib/routing/shortestPaths'
import { graphFixture } from '../src/lib/testing/graphFixture'
import { pinFidelity, pinnedRoute, urlWaypoints } from './pins'

//  A ===== B ===== C       the fast road, 600 s a leg
//   \_ T1 ___ T2 _/        the twisty way, slower, with T1 and T2 on it
const graph = graphFixture(
  [[0, 40], [0.1, 40], [0.2, 40], [0.05, 40.03], [0.15, 40.03]],
  [
    { from: 0, to: 1, timeS: 600 },
    { from: 1, to: 2, timeS: 600 },
    { from: 0, to: 3, timeS: 500 },
    { from: 3, to: 4, timeS: 500 },
    { from: 4, to: 2, timeS: 500 },
  ],
)
const tools = { graph, locator: new NodeLocator(graph), searches: { forward: new ShortestPaths(graph), backward: new ShortestPaths(graph, 'backward') }, weights: new EdgeWeights(graph) }
const twisty = { line: [[0.05, 40.03], [0.15, 40.03]] as LonLat[], lengthM: 8_500 }
const url = (pins: LonLat[]) => `https://www.google.com/maps/dir/?api=1&waypoints=${pins.map(([lon, lat]) => `${lat},${lon}`).join('|')}`

describe('pins', () => {
  it('reads the waypoints of a Google Maps URL', () => {
    expect(urlWaypoints('https://www.google.com/maps/dir/?api=1&origin=1,2')).toEqual([])
    expect(urlWaypoints(url([[0.05, 40.03], [0.15, 40.03]]))).toEqual([[0.05, 40.03], [0.15, 40.03]])
  })

  it('rides the fastest road between the points, through the pins', () => {
    const direct = pinnedRoute(tools, [0, 40], [], [0.2, 40])
    expect(direct?.every(([, lat]) => lat === 40)).toBe(true)
    const pinned = pinnedRoute(tools, [0, 40], [[0.05, 40.03], [0.15, 40.03]], [0.2, 40])
    expect(pinned?.some(([, lat]) => lat > 40.02)).toBe(true)
  })

  it('finds the twisty km reproduced: all of them with pins, none without', () => {
    expect(pinFidelity(tools, [twisty], url([[0.05, 40.03], [0.15, 40.03]]), [0, 40], [0.2, 40])).toBeCloseTo(1, 1)
    expect(pinFidelity(tools, [twisty], url([]), [0, 40], [0.2, 40])).toBeLessThan(0.1)
  })

  it('has nothing to measure without twisties', () => {
    expect(pinFidelity(tools, [], url([]), [0, 40], [0.2, 40])).toBeNull()
  })
})
