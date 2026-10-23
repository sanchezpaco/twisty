import { describe, expect, it } from 'vitest'
import { stopsHidden, VERY_SHORT_TRIP_S } from './shortTrip'

const rides = (fastestS: number, count: number) => Array.from({ length: count }, (_, index) => ({ timeS: fastestS + index * 600 }))

describe('stopsHidden', () => {
  it('hides the stops of a very short trip', () => {
    expect(stopsHidden(rides(4 * 60, 6), false, false)).toBe(true)
  })

  it('keeps a trip of 15 minutes or more as it is', () => {
    expect(stopsHidden(rides(VERY_SHORT_TRIP_S, 6), false, false)).toBe(false)
    expect(stopsHidden(rides(28 * 60, 6), false, false)).toBe(false)
  })

  it('shows them once the rider asked', () => {
    expect(stopsHidden(rides(4 * 60, 6), false, true)).toBe(false)
  })

  it('has nothing to hide for a trip with a single ride or still being searched', () => {
    expect(stopsHidden(rides(4 * 60, 1), false, false)).toBe(false)
    expect(stopsHidden(rides(4 * 60, 1), true, false)).toBe(false)
    expect(stopsHidden(rides(4 * 60, 6), true, false)).toBe(false)
  })
})
