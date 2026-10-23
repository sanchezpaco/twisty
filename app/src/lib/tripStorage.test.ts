import { afterEach, describe, expect, it, vi } from 'vitest'
import { isRestorable, loadTrip, parseTrip, RESTORE_WINDOW_MS, saveTrip, serializeTrip, type StoredTrip, takeTrip } from './tripStorage'

const trip: StoredTrip = {
  from: { label: 'València', position: [-0.3763, 39.4699] },
  to: { label: 'Los Santos de Maimona', position: [-6.3797, 38.4503] },
  via: [],
  includeTracks: true,
  selected: 5,
  at: 1_000_000,
}

describe('stored trip', () => {
  it('round-trips the places, the tracks switch and the slider stop', () => {
    expect(parseTrip(serializeTrip(trip))).toEqual(trip)
  })

  it('round-trips the stops, and writes a trip without them as before stops existed', () => {
    const withStops = { ...trip, via: [{ label: 'Chelva', position: [-0.998, 39.749] as [number, number] }] }
    expect(parseTrip(serializeTrip(withStops))).toEqual(withStops)
    expect(serializeTrip(trip)).not.toContain('via')
    const { via: _via, ...older } = trip
    expect(parseTrip(JSON.stringify(older))).toEqual(trip)
  })

  it('keeps only what planning again needs from a place', () => {
    const detailed = { ...trip, from: { ...trip.from!, kind: 'town' as const, context: 'València', distanceM: 12 } }
    expect(parseTrip(serializeTrip(detailed))?.from).toEqual(trip.from)
  })

  it('remembers that an end was the rider\'s own position', () => {
    const here = { ...trip, from: { ...trip.from!, here: true as const } }
    expect(parseTrip(serializeTrip(here))?.from?.here).toBe(true)
  })

  it('restores a trip with an empty end', () => {
    const half = { ...trip, to: null }
    expect(parseTrip(serializeTrip(half))).toEqual(half)
  })

  it.each([
    ['nothing stored', null],
    ['not JSON', '{"from":'],
    ['not an object', '42'],
    ['a place without a position', JSON.stringify({ ...trip, from: { label: 'València' } })],
    ['a position off the globe', JSON.stringify({ ...trip, to: { label: 'B', position: [-6, 120] } })],
    ['a non-numeric coordinate', JSON.stringify({ ...trip, to: { label: 'B', position: ['x', 38] } })],
    ['a missing tracks switch', JSON.stringify({ ...trip, includeTracks: undefined })],
    ['a negative slider stop', JSON.stringify({ ...trip, selected: -1 })],
    ['a fractional slider stop', JSON.stringify({ ...trip, selected: 1.5 })],
    ['a trip without a time (written by an older version)', JSON.stringify({ ...trip, at: undefined })],
  ])('ignores %s', (_, text) => {
    expect(parseTrip(text)).toBeNull()
  })
})

describe('restore window', () => {
  it('restores a ride handed over a moment ago and one just inside the window', () => {
    expect(isRestorable(trip, trip.at + 1)).toBe(true)
    expect(isRestorable(trip, trip.at + RESTORE_WINDOW_MS - 1)).toBe(true)
  })

  it('does not restore a ride handed over the window ago or earlier', () => {
    expect(isRestorable(trip, trip.at + RESTORE_WINDOW_MS)).toBe(false)
    expect(isRestorable(trip, trip.at + 24 * 60 * 60 * 1000)).toBe(false)
  })

  it('does not restore a ride stamped in the future (a clock that went back)', () => {
    expect(isRestorable(trip, trip.at - 1)).toBe(false)
  })
})

describe('starting over', () => {
  afterEach(() => vi.unstubAllGlobals())

  const storage = () => {
    const items = new Map<string, string>()
    return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value), removeItem: (key: string) => void items.delete(key) }
  }

  it('takes the ride handed over out of storage, so a restart does not bring it back', () => {
    vi.stubGlobal('localStorage', storage())
    saveTrip(trip)
    expect(takeTrip(trip.at + 1)).toEqual(trip)
    expect(loadTrip(trip.at + 2)).toBeNull()
  })

  // Undo saves it back as it was: the restore window still counts from when the ride was handed over.
  it('lets Undo put it back with its own time', () => {
    vi.stubGlobal('localStorage', storage())
    saveTrip(trip)
    saveTrip(takeTrip(trip.at + 1)!)
    expect(loadTrip(trip.at + 2)).toEqual(trip)
  })

  it('takes nothing when nothing was handed over, or storage is unavailable', () => {
    vi.stubGlobal('localStorage', storage())
    expect(takeTrip(trip.at)).toBeNull()
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied') }, removeItem: () => { throw new Error('denied') } })
    expect(takeTrip(trip.at)).toBeNull()
  })
})
