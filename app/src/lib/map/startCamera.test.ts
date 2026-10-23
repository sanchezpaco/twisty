import { describe, expect, it } from 'vitest'
import { goesToStart, START_ZOOM } from './startCamera'

const alone = { start: true, finish: false, ride: false, zoom: 5.5, startInView: true }

describe('goesToStart', () => {
  it('goes to a start set alone from the Spain view', () => {
    expect(goesToStart(alone)).toBe(true)
  })

  it('goes to a start out of view, whatever the zoom', () => {
    expect(goesToStart({ ...alone, zoom: 12, startInView: false })).toBe(true)
  })

  // A long-press on the map: the rider is already looking at the place.
  it('stays when the start is in view close enough', () => {
    expect(goesToStart({ ...alone, zoom: START_ZOOM - 1, startInView: true })).toBe(false)
  })

  // A recent trip, Undo or a restored trip set both ends at once: the ride's own framing is the only move.
  it('leaves the camera to the ride once there is a finish or a ride', () => {
    expect(goesToStart({ ...alone, finish: true })).toBe(false)
    expect(goesToStart({ ...alone, ride: true })).toBe(false)
    expect(goesToStart({ ...alone, start: false })).toBe(false)
  })
})
