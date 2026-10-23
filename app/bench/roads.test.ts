import { describe, expect, it } from 'vitest'
import { graphFixture } from '../src/lib/testing/graphFixture'
import { coveredShare, funShare, isRidden, labelParts, type KnownRoad, type LocatedRoad, locateRoad, matchesRoad, PolylineIndex, resample } from './roads'

describe('labels', () => {
  it('splits a label into ref and name, telling a lone ref from a lone name', () => {
    expect(labelParts('CV-35 · Carretera València - Ademuz')).toEqual({ ref: 'CV-35', name: 'Carretera València - Ademuz' })
    expect(labelParts('CV-345')).toEqual({ ref: 'CV-345' })
    expect(labelParts('Ma-4040B')).toEqual({ ref: 'Ma-4040B' })
    expect(labelParts('Carretera de Tost')).toEqual({ name: 'Carretera de Tost' })
    expect(labelParts('')).toEqual({})
  })

  it('matches refs and names exactly, not as substrings', () => {
    expect(matchesRoad('CV-35 · Carretera València - Ademuz', { ref: 'CV-35' })).toBe(true)
    expect(matchesRoad('CV-350', { ref: 'CV-35' })).toBe(false)
    expect(matchesRoad('CV-35 · Autovia del Túria', { ref: 'CV-35', name: 'Carretera València - Ademuz' })).toBe(false)
    expect(matchesRoad('Carretera a Castellar de Tost', { name: 'Carretera de Tost' })).toBe(false)
    expect(matchesRoad('Carretera de Tost', { name: 'Carretera de Tost' })).toBe(true)
  })
})

//  0 --- 1 --- 2 --- 3          CV-9 from node 0 to node 3 (its edges are 1, 2, 3 km)
//        |
//        4 -- 5                  CV-90, which a substring match would take for CV-9
const graph = graphFixture(
  [
    [0, 0],
    [0.01, 0],
    [0.03, 0],
    [0.06, 0],
    [0.01, 0.02],
    [0.03, 0.02],
  ],
  [
    { from: 0, to: 1, timeS: 100, lengthM: 1_000, road: 1 },
    { from: 1, to: 2, timeS: 200, lengthM: 2_000, road: 1 },
    { from: 2, to: 3, timeS: 300, lengthM: 3_000, road: 1 },
    { from: 1, to: 4, timeS: 100, lengthM: 2_200, road: 2 },
    { from: 4, to: 5, timeS: 100, lengthM: 2_200, road: 2 },
  ],
  ['', 'CV-9 · Carretera de Prueba', 'CV-90'],
)
const road = (extra: Partial<KnownRoad> = {}): KnownRoad => ({
  id: 'cv-9',
  ref: 'CV-9',
  region: 'Test',
  from: [0, 0],
  to: [0.06, 0],
  why: 'test',
  addedBy: 'test',
  addedOn: '2026-10-14',
  ...extra,
})

describe('locateRoad', () => {
  it('follows the matching edges between the points', () => {
    const result = locateRoad(graph, road())
    expect(result).toMatchObject({ located: { edges: [0, 1, 2], lengthM: 6_000, timeS: 600, startNode: 0, endNode: 3, deadEnd: true } })
  })

  it('snaps points that are near the road, in either order, and takes via points in turn', () => {
    const result = locateRoad(graph, road({ from: [0.06, 0.001], to: [0.0001, 0], via: [[0.03, 0]] }))
    expect(result).toMatchObject({ located: { edges: [2, 1, 0], startNode: 3, endNode: 0 } })
  })

  it('is not a dead end when the road goes on at both ends', () => {
    const result = locateRoad(graph, road({ from: [0.01, 0], to: [0.03, 0] }), 2)
    expect(result).toMatchObject({ located: { edges: [1], deadEnd: false } })
  })

  it('is a dead end when an end only leads to a pocket, even if the end node has other roads', () => {
    //  4 -- 0 === 1 -- 2 -- 3        the road is 0 === 1; beyond 1 there is only a pocket of 3 nodes
    //  |
    //  5 -- 6 -- 7
    const pocket = graphFixture(
      [[0, 0], [0.01, 0], [0.02, 0], [0.03, 0], [0, 0.01], [0, 0.02], [0.01, 0.02], [0.02, 0.02]],
      [
        { from: 0, to: 1, timeS: 100, lengthM: 1_000, road: 1 },
        { from: 1, to: 2, timeS: 100, lengthM: 1_000, road: 2 },
        { from: 2, to: 3, timeS: 100, lengthM: 1_000, road: 2 },
        { from: 0, to: 4, timeS: 100, lengthM: 1_000, road: 2 },
        { from: 4, to: 5, timeS: 100, lengthM: 1_000, road: 2 },
        { from: 5, to: 6, timeS: 100, lengthM: 1_000, road: 2 },
        { from: 6, to: 7, timeS: 100, lengthM: 1_000, road: 2 },
      ],
      ['', 'CV-9', 'CV-90'],
    )
    expect(locateRoad(pocket, road({ from: [0, 0], to: [0.01, 0] }), 4)).toMatchObject({ located: { deadEnd: true } })
    expect(locateRoad(pocket, road({ from: [0, 0], to: [0.01, 0] }), 3)).toMatchObject({ located: { deadEnd: false } })
  })

  it('tells how much of the road the graph counts as fun', () => {
    const fun = graphFixture(
      [[0, 0], [0.01, 0], [0.02, 0]],
      [
        { from: 0, to: 1, timeS: 100, lengthM: 1_000, funM: 900, road: 1 },
        { from: 1, to: 2, timeS: 100, lengthM: 3_000, funM: 300, road: 1 },
      ],
      ['', 'CV-9'],
    )
    const located = (locateRoad(fun, road({ from: [0, 0], to: [0.02, 0] }), 1) as { located: LocatedRoad }).located
    expect(funShare(fun, located)).toBeCloseTo(0.3)
  })

  it('takes the scout’s word for a dead end', () => {
    expect(locateRoad(graph, road({ from: [0.01, 0], to: [0.03, 0], deadEnd: true }), 2)).toMatchObject({ located: { deadEnd: true } })
  })

  it('says why a road cannot be found', () => {
    expect(locateRoad(graph, road({ ref: 'CV-1' }))).toEqual({ unlocatable: 'no edge of the graph has that ref and name' })
    expect(locateRoad(graph, road({ from: [1, 1] }))).toMatchObject({ unlocatable: expect.stringMatching(/within 500 m of point 0/) })
    expect(locateRoad(graph, road({ ref: undefined, name: undefined }))).toMatchObject({ unlocatable: expect.stringMatching(/neither/) })
  })

  it('does not join points through roads that do not match', () => {
    const split = road({ ref: 'CV-90', from: [0.01, 0.02], to: [0.03, 0.02] })
    expect(locateRoad(graph, split)).toMatchObject({ located: { edges: [4] } })
    expect(locateRoad(graph, road({ ref: 'CV-90', from: [0, 0], to: [0.03, 0.02] }))).toMatchObject({ unlocatable: expect.stringMatching(/within 500 m of point 0/) })
  })
})

describe('riding by geometry', () => {
  const trace = (lat: number): [number, number][] => [
    [0, lat],
    [0.03, lat],
    [0.06, lat],
  ]

  it('resamples a line every 50 m, ends included', () => {
    const samples = resample([[0, 0], [0.01, 0]], 50)
    expect(samples[0]).toEqual([0, 0])
    expect(samples.at(-1)).toEqual([0.01, 0])
    expect(samples.length).toBeGreaterThan(20)
  })

  it('counts a road as ridden when an option follows it within the tolerance, on either carriageway', () => {
    const index = new PolylineIndex([trace(0.0003)])
    expect(coveredShare(index, trace(0))).toBe(1)
    expect(isRidden(index, trace(0))).toBe(true)
  })

  it('does not count a parallel road a few hundred metres away', () => {
    const index = new PolylineIndex([trace(0.004)])
    expect(coveredShare(index, trace(0))).toBe(0)
  })

  it('counts a share when the option leaves the road part way', () => {
    const index = new PolylineIndex([[[0, 0], [0.036, 0]]])
    expect(coveredShare(index, trace(0))).toBeCloseTo(0.6, 1)
    expect(isRidden(index, trace(0))).toBe(false)
  })
})
