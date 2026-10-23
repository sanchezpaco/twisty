import { describe, expect, it } from 'vitest'
import { TRACKS_OFFERED, tracksFor } from './offRoad'

describe('tracksFor', () => {
  it('plans a trip saved with tracks on roads while tracks are not offered', () => {
    expect(tracksFor(true)).toBe(TRACKS_OFFERED)
    expect(tracksFor(false)).toBe(false)
  })
})
