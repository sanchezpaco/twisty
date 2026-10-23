import { isLonLat } from './geo'
import type { Place } from './geocoding'

const STORAGE_KEY = 'twisty.trip'

/** Android may close Twisty while the rider is in another app; a ride handed over longer ago than this is not brought back. */
export const RESTORE_WINDOW_MS = 2 * 60 * 60 * 1000

/** The ride the rider just handed to another app: what survives Android killing Twisty meanwhile, planned again on restore. */
export interface StoredTrip {
  from: Place | null
  to: Place | null
  /** The rider's stops between them, in riding order; none on a trip stored before stops existed. */
  via: Place[]
  includeTracks: boolean
  /** Slider stop the rider had chosen. */
  selected: number
  /** When it was handed over, in ms since the epoch. */
  at: number
}

export function serializeTrip(trip: StoredTrip): string {
  return JSON.stringify({
    from: trip.from && storedPlace(trip.from),
    to: trip.to && storedPlace(trip.to),
    // Written only when there are stops, so a trip without them reads as it always did.
    ...(trip.via.length > 0 && { via: trip.via.map(storedPlace) }),
    includeTracks: trip.includeTracks,
    selected: trip.selected,
    at: trip.at,
  })
}

/** Stored text is outside the app's control (older versions, a cleared half-write): anything odd means no trip. */
export function parseTrip(text: string | null): StoredTrip | null {
  if (!text) return null
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const { from, to, via, includeTracks, selected, at } = data as Record<string, unknown>
  const start = parsePlace(from)
  const finish = parsePlace(to)
  if (start === undefined || finish === undefined) return null
  const stops = via === undefined ? [] : Array.isArray(via) ? via.map(parsePlace) : null
  if (!stops || stops.some((stop) => !stop)) return null
  if (typeof includeTracks !== 'boolean') return null
  if (typeof selected !== 'number' || !Number.isInteger(selected) || selected < 0) return null
  if (typeof at !== 'number' || !Number.isFinite(at)) return null
  return { from: start, to: finish, via: stops as Place[], includeTracks, selected, at }
}

export function isRestorable(trip: StoredTrip, now: number): boolean {
  const age = now - trip.at
  return age >= 0 && age < RESTORE_WINDOW_MS
}

export function saveTrip(trip: StoredTrip): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeTrip(trip))
  } catch {
    // Private browsing or a full quota: the trip just does not survive a restart.
  }
}

/** The ride handed over within the restore window; an older one is deleted, its coordinates are not kept longer. */
export function loadTrip(now: number): StoredTrip | null {
  try {
    const trip = parseTrip(localStorage.getItem(STORAGE_KEY))
    if (trip && isRestorable(trip, now)) return trip
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage is unavailable: nothing to restore.
  }
  return null
}

/** Takes the ride handed over out of storage for a rider who starts over, so a restart does not bring it back. */
export function takeTrip(now: number): StoredTrip | null {
  const trip = loadTrip(now)
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage is unavailable: there is nothing kept to take.
  }
  return trip
}

function storedPlace(place: Place) {
  return { label: place.label, position: place.position, ...(place.here && { here: true }) }
}

/** `null` is an empty end, `undefined` is a malformed one. */
function parsePlace(value: unknown): Place | null | undefined {
  if (value === null) return null
  if (typeof value !== 'object' || value === undefined) return undefined
  const { label, position, here } = value as Record<string, unknown>
  if (typeof label !== 'string' || !isLonLat(position)) return undefined
  return { label, position, ...(here === true && { here: true as const }) }
}
