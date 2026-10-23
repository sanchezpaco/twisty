import { describe, expect, it } from 'vitest'
import type { Twisty } from '../src/lib/data/twisties'
import type { LonLat } from '../src/lib/geo'
import { EdgeWeights } from '../src/lib/routing/edgeWeights'
import { NodeLocator } from '../src/lib/routing/nodeLocator'
import { ShortestPaths } from '../src/lib/routing/shortestPaths'
import { graphFixture } from '../src/lib/testing/graphFixture'
import { ModelRecall, twistyLabel } from './modelRecall'
import { PolylineIndex } from './roads'

//  A ---- B ---- C       600 s a leg
//         |      |
//         3 ~~~~ 4       a twisty: 300 s, 200 s to reach it and 200 s to leave it, so a 100 s detour
const graph = graphFixture(
  [[0, 40], [0.1, 40], [0.2, 40], [0.1, 40.05], [0.2, 40.05]],
  [
    { from: 0, to: 1, timeS: 600 },
    { from: 1, to: 2, timeS: 600 },
    { from: 1, to: 3, timeS: 200 },
    { from: 3, to: 4, timeS: 300 },
    { from: 4, to: 2, timeS: 200 },
  ],
)
const line: LonLat[] = [[0.1, 40.05], [0.2, 40.05]]
const twisty = (rating: number, extra: Partial<Twisty> = {}): Twisty => ({ id: 7, name: 'Carretera de Prueba', ref: 'X-1', lengthM: 8_500, twist: 300, rating, line, ...extra })
const tools = () => ({
  locator: new NodeLocator(graph),
  searches: { fromStart: new ShortestPaths(graph), fromEnd: new ShortestPaths(graph, 'backward') },
  weights: new EdgeWeights(graph),
})
const trip = { from: [0, 40] as LonLat, to: [0.2, 40] as LonLat, includeTracks: false }
const stopOn = (lineOfStop: LonLat[]) => new PolylineIndex([lineOfStop])

describe('ModelRecall', () => {
  it('lists a well-rated road a short detour away that no stop rides', () => {
    const missed = new ModelRecall([twisty(5)], tools()).missed(trip, 0, 2, [stopOn([[0, 40], [0.2, 40]])])
    expect(missed).toEqual([{ id: 7, label: 'X-1 · Carretera de Prueba', rating: 5, lengthM: 8_500, costS: 100 }])
  })

  it('does not list a road a stop rides, a road rated too low or one that costs too much', () => {
    expect(new ModelRecall([twisty(5)], tools()).missed(trip, 0, 2, [stopOn(line)])).toEqual([])
    expect(new ModelRecall([twisty(3)], tools()).missed(trip, 0, 2, [])).toEqual([])
    const far = twisty(5, { line: [[0.1, 41.5], [0.2, 41.5]] })
    expect(new ModelRecall([far], tools()).missed(trip, 0, 2, [])).toEqual([])
  })

  it('names a twisty by ref and name, or by its number', () => {
    expect(twistyLabel(twisty(5))).toBe('X-1 · Carretera de Prueba')
    expect(twistyLabel(twisty(5, { ref: null }))).toBe('Carretera de Prueba')
    expect(twistyLabel(twisty(5, { ref: null, name: null }))).toBe('unnamed #7')
  })
})
