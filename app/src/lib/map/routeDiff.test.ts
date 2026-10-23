import { describe, expect, it } from 'vitest'
import type { LonLat } from '../geo'
import type { RouteSegment } from '../routing/ride'
import { routeDiff, routeLine, sliceSegments } from './routeDiff'

const line = (...ids: number[]): LonLat[] => ids.map((id) => [id, id * 10])

describe('routeDiff', () => {
  it('finds nothing to redraw in identical lines', () => {
    const a = line(1, 2, 3, 4)
    expect(routeDiff(a, line(1, 2, 3, 4))).toEqual({ prefixEnd: 4, oldSuffixStart: 4, newSuffixStart: 4 })
  })

  it('finds a change in the middle', () => {
    expect(routeDiff(line(1, 2, 3, 4, 5), line(1, 2, 8, 9, 4, 5))).toEqual({
      prefixEnd: 2,
      oldSuffixStart: 3,
      newSuffixStart: 4,
    })
  })

  it('finds a change at the start', () => {
    expect(routeDiff(line(1, 2, 3, 4), line(7, 2, 3, 4))).toEqual({ prefixEnd: 0, oldSuffixStart: 1, newSuffixStart: 1 })
  })

  it('finds a change at the end', () => {
    expect(routeDiff(line(1, 2, 3, 4), line(1, 2, 3, 7))).toEqual({ prefixEnd: 3, oldSuffixStart: 4, newSuffixStart: 4 })
  })

  it('shares nothing between completely different lines', () => {
    expect(routeDiff(line(1, 2, 3), line(7, 8, 9, 10))).toEqual({ prefixEnd: 0, oldSuffixStart: 3, newSuffixStart: 4 })
  })

  it('handles a new line that only extends or shortens the old one', () => {
    expect(routeDiff(line(1, 2), line(1, 2, 3, 4))).toEqual({ prefixEnd: 2, oldSuffixStart: 2, newSuffixStart: 4 })
    expect(routeDiff(line(1, 2, 3, 4), line(1, 2))).toEqual({ prefixEnd: 2, oldSuffixStart: 4, newSuffixStart: 2 })
  })

  it('never counts a point in both the prefix and the suffix', () => {
    expect(routeDiff(line(1, 2, 3), line(1, 2, 2, 3))).toEqual({ prefixEnd: 2, oldSuffixStart: 2, newSuffixStart: 3 })
  })

  it('handles empty lines', () => {
    expect(routeDiff([], [])).toEqual({ prefixEnd: 0, oldSuffixStart: 0, newSuffixStart: 0 })
    expect(routeDiff([], line(1, 2))).toEqual({ prefixEnd: 0, oldSuffixStart: 0, newSuffixStart: 2 })
  })
})

describe('sliceSegments', () => {
  const segments: RouteSegment[] = [
    { kind: 'transit', line: line(1, 2, 3) },
    { kind: 'twisty', line: line(3, 4, 5), rating: 4 },
    { kind: 'transit', line: line(5, 6) },
  ]

  it('walks the ride as one line', () => {
    expect(routeLine(segments)).toEqual(line(1, 2, 3, 3, 4, 5, 5, 6))
  })

  it('keeps the whole ride when asked for all of it', () => {
    expect(sliceSegments(segments, 0, 7)).toEqual(segments)
  })

  it('cuts inside a segment and keeps its kind and rating', () => {
    expect(sliceSegments(segments, 1, 4)).toEqual([
      { kind: 'transit', line: line(2, 3) },
      { kind: 'twisty', line: line(3, 4), rating: 4 },
    ])
  })

  it('drops what is left of a segment with a single point', () => {
    expect(sliceSegments(segments, 2, 3)).toEqual([])
    expect(sliceSegments(segments, 2, 4)).toEqual([{ kind: 'twisty', line: line(3, 4), rating: 4 }])
  })

  it('gives nothing for an empty stretch', () => {
    expect(sliceSegments(segments, 5, 5)).toEqual([])
    expect(sliceSegments(segments, 9, 12)).toEqual([])
  })
})
