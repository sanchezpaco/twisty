import { describe, expect, it } from 'vitest'
import { cumulativeDistancesM, type LonLat } from '../geo'
import { type BadgeSite, placeBadges } from './badgePlacement'

// A thousand pixels to the degree keeps the numbers in the tests readable.
const project = ([lon, lat]: LonLat) => ({ x: lon * 1000, y: -lat * 1000 })
const site = (from: LonLat, to: LonLat, priority = 0): BadgeSite => {
  const line = [from, to]
  return { line, cumulative: cumulativeDistancesM(line), priority }
}

describe('placeBadges', () => {
  it('puts a lone badge in the middle of its road at full size', () => {
    const [badge] = placeBadges([site([0, 0], [0.2, 0])], project, [])
    expect(badge.scale).toBe(1)
    expect(badge.at[0]).toBeCloseTo(0.1)
  })

  it('moves the less important of two badges along its road instead of dropping it', () => {
    // Both middles are 8 px apart, much less than two badges.
    const first = site([0, 0], [0.1, 0], -2)
    const second = site([0.008, 0], [0.108, 0], -1)
    const [a, b] = placeBadges([first, second], project, [])
    expect(a.scale).toBe(1)
    expect(a.at[0]).toBeCloseTo(0.05)
    expect(b).toBeDefined()
    const apart = Math.abs(project(a.at).x - project(b.at).x)
    expect(apart).toBeGreaterThanOrEqual(27)
  })

  it('shrinks a badge that has no room to move', () => {
    const first = site([0, 0], [0.001, 0], -2)
    const second = site([0, 0.012], [0.001, 0.012], -1)
    const [, b] = placeBadges([first, second], project, [])
    expect(b.scale).toBeLessThan(1)
  })

  it('keeps clear of the A and B pins', () => {
    const [badge] = placeBadges([site([0, 0], [0.2, 0])], project, [{ x: 100, y: 0 }])
    expect(Math.abs(project(badge.at).x - 100)).toBeGreaterThanOrEqual(30)
  })

  it('puts a badge with no room where it is least in the way of a pin, not on it', () => {
    // A 20 px road with a pin on its middle: no spot fits, and the end farthest from the pin is the least in the way.
    const [badge] = placeBadges([site([0, 0], [0.02, 0])], project, [{ x: 10, y: 0 }])
    expect(badge.scale).toBe(0.6)
    expect(Math.abs(project(badge.at).x - 10)).toBeGreaterThanOrEqual(5)
  })

  it('places every badge, in the order it was given, even when nothing fits', () => {
    const crowded = [0, 1, 2, 3].map((i) => site([0, 0], [0.001, 0], i))
    const placed = placeBadges(crowded, project, [])
    expect(placed).toHaveLength(4)
    expect(placed.every((p) => p.scale === 0.6 || p.scale === 0.75 || p.scale === 1)).toBe(true)
  })
})
