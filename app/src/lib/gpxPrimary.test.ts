import { describe, expect, it } from 'vitest'
import { gpxIsPrimary } from './gpxPrimary'

describe('gpxIsPrimary', () => {
  it('keeps Google Maps for rides with no track or a short one', () => {
    expect(gpxIsPrimary({ trackM: 0 })).toBe(false)
    expect(gpxIsPrimary({ trackM: 200 })).toBe(false)
    expect(gpxIsPrimary({ trackM: 1_999 })).toBe(false)
  })

  it('makes the GPX the main button from 2 km of track', () => {
    expect(gpxIsPrimary({ trackM: 2_000 })).toBe(true)
    expect(gpxIsPrimary({ trackM: 3_000 })).toBe(true)
  })
})
