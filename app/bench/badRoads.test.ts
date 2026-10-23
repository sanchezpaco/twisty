import { describe, expect, it } from 'vitest'
import type { LonLat } from '../src/lib/geo'
import { BAD_ROAD_MIN_M, badRoadsRidden } from './badRoads'
import { type LocatedRoad, PolylineIndex } from './roads'

const bad = (id: string, line: LonLat[], lengthM: number): LocatedRoad => ({ id, edges: [], line, lengthM, timeS: 0, startNode: 0, endNode: 1, deadEnd: false })

describe('badRoadsRidden', () => {
  const road = bad('gravel', [[0, 40], [0.01, 40]], 850)

  it('names a bad road an option follows for long enough', () => {
    expect(badRoadsRidden(new PolylineIndex([[[0, 40], [0.01, 40]]]), [road])).toEqual([{ id: 'gravel', riddenM: expect.any(Number) }])
  })

  it('ignores a bad road that is only crossed or touched', () => {
    expect(badRoadsRidden(new PolylineIndex([[[0.005, 39.99], [0.005, 40.01]]]), [road])).toEqual([])
    expect(BAD_ROAD_MIN_M).toBe(300)
  })

  it('ignores bad roads far from the option', () => {
    expect(badRoadsRidden(new PolylineIndex([[[0, 41], [0.01, 41]]]), [road])).toEqual([])
  })
})
