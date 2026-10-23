import { describe, expect, it } from 'vitest'
import type { LonLat } from './geo'
import { decodeLine, encodeLine } from './polyline'

describe('encoded lines', () => {
  it('give back the line to a millionth of a degree', () => {
    const line: LonLat[] = [
      [-0.5494123, 42.5693456],
      [-0.5493, 42.5694],
      [0.5237891, 42.6053012],
    ]
    const back = decodeLine(encodeLine(line))
    expect(back).toHaveLength(3)
    back.forEach(([lon, lat], i) => {
      expect(lon).toBeCloseTo(line[i][0], 6)
      expect(lat).toBeCloseTo(line[i][1], 6)
    })
  })

  it('cross the whole of Spain and both signs in one step', () => {
    const line: LonLat[] = [
      [-9.29, 43.78],
      [4.31, 36.01],
      [-9.29, 36.01],
    ]
    expect(decodeLine(encodeLine(line))).toEqual(line)
  })

  it('round to the millionth', () => {
    expect(decodeLine(encodeLine([[0.0000004, -0.0000006]]))).toEqual([[0, -0.000001]])
  })

  it('are empty for an empty line', () => {
    expect(encodeLine([])).toBe('')
    expect(decodeLine('')).toEqual([])
  })

  it('refuse text no line was encoded into', () => {
    expect(() => decodeLine('~')).toThrow()
    expect(() => decodeLine('a b')).toThrow()
  })
})
