import { isLonLat, type LonLat } from './geo'
import type { Place } from './geocoding'

const STORAGE_KEY = 'twisty.trips'

/** What fits the start screen without turning it into a menu. */
export const HISTORY_MAX = 5

/** The rider's own position is never kept (it would be their home or hotel): the entry says "here" and asks again. */
export type HistoryPlace = { here: true } | { label: string; position: LonLat }

export interface HistoryTrip {
  from: HistoryPlace
  to: HistoryPlace
  /** The rider's stops between them, in riding order; none on a trip kept before stops existed. */
  via: HistoryPlace[]
  includeTracks: boolean
  /** Slider stop the rider had chosen, opened again when the trip is planned from the list. */
  selected: number
  /** When the rider last handed it over or left it on screen, in ms since the epoch. */
  at: number
  /** Handed to a navigation app; at most one entry is not (the ride that was on screen when the app closed). */
  handed: boolean
}

export type TripInput = Omit<HistoryTrip, 'handed'>

export function historyPlace(place: Place): HistoryPlace {
  return place.here ? { here: true } : { label: place.label, position: place.position }
}

/** Planning the trip again needs the rider's position today: an end was "here" (a stop never is). */
export const needsHere = (trip: TripInput): boolean => 'here' in trip.from || 'here' in trip.to

/** The trip's places to plan again, every "here" end at the rider's position today; null when that is needed and unknown. */
export function restoreTrip(trip: TripInput, here: Place | null): { from: Place; via: Place[]; to: Place } | null {
  const placeOf = (place: HistoryPlace) => ('here' in place ? here : { label: place.label, position: place.position })
  const from = placeOf(trip.from)
  const to = placeOf(trip.to)
  if (!from || !to) return null
  return { from, via: trip.via.flatMap((stop) => ('here' in stop ? [] : [placeOf(stop) as Place])), to }
}

/** The same places in the same order; the tracks switch and the slider stop are not part of the identity. */
export function sameTrip(a: TripInput, b: TripInput): boolean {
  return samePlace(a.from, b.from) && samePlace(a.to, b.to) && a.via.length === b.via.length && a.via.every((stop, i) => samePlace(stop, b.via[i]))
}

/** A ride handed to a navigation app goes to the top; the same trip handed before is promoted, not repeated. */
export function recordHandedOver(list: HistoryTrip[], trip: TripInput): HistoryTrip[] {
  return [{ ...trip, handed: true }, ...list.filter((entry) => !sameTrip(entry, trip))].slice(0, HISTORY_MAX)
}

/** The ride on screen when the app closes: it replaces the previous never-handed entry, and a trip already handed stays so. */
export function recordPlanned(list: HistoryTrip[], trip: TripInput): HistoryTrip[] {
  const handed = list.some((entry) => entry.handed && sameTrip(entry, trip))
  return [{ ...trip, handed }, ...list.filter((entry) => entry.handed && !sameTrip(entry, trip))].slice(0, HISTORY_MAX)
}

export function removeTrip(list: HistoryTrip[], index: number): HistoryTrip[] {
  return list.filter((_, at) => at !== index)
}

/**
 * Undo of a removal: the trips as they were, with any trip recorded since kept too (it is newer, so its entry wins over
 * the same trip's older one), newest first.
 */
export function restoreTrips(current: HistoryTrip[], before: HistoryTrip[]): HistoryTrip[] {
  const merged = [...current, ...before.filter((old) => !current.some((entry) => sameTrip(entry, old)))]
  return keepsOnePlanned(merged.sort((a, b) => b.at - a.at)).slice(0, HISTORY_MAX)
}

/** Whole calendar days between two moments, in the rider's time zone. */
export function daysAgo(at: number, now: number): number {
  const day = (ms: number) => {
    const date = new Date(ms)
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  }
  return Math.round((day(now) - day(at)) / 86_400_000)
}

export function serializeHistory(list: HistoryTrip[]): string {
  // A trip without stops is written as it always was.
  return JSON.stringify(list.map(({ via, ...trip }) => (via.length > 0 ? { ...trip, via } : trip)))
}

/** Stored text is outside the app's control: anything odd means an empty history, and a bad entry is dropped alone. */
export function parseHistory(text: string | null): HistoryTrip[] {
  if (!text) return []
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const trips = data.flatMap((entry) => parseEntry(entry) ?? [])
  return keepsOnePlanned(trips).slice(0, HISTORY_MAX)
}

export function loadHistory(): HistoryTrip[] {
  try {
    return parseHistory(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

export function saveHistory(list: HistoryTrip[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeHistory(list))
  } catch {
    // Private browsing or a full quota: the history just does not last.
  }
}

function samePlace(a: HistoryPlace, b: HistoryPlace): boolean {
  if ('here' in a || 'here' in b) return 'here' in a && 'here' in b
  return a.label === b.label && a.position[0] === b.position[0] && a.position[1] === b.position[1]
}

function keepsOnePlanned(list: HistoryTrip[]): HistoryTrip[] {
  const firstPlanned = list.findIndex((entry) => !entry.handed)
  return list.filter((entry, index) => entry.handed || index === firstPlanned)
}

function parseEntry(value: unknown): HistoryTrip | null {
  if (typeof value !== 'object' || value === null) return null
  const { from, to, via, includeTracks, selected, at, handed } = value as Record<string, unknown>
  const start = parseHistoryPlace(from)
  const finish = parseHistoryPlace(to)
  if (!start || !finish) return null
  const stops = via === undefined ? [] : Array.isArray(via) ? via.map(parseHistoryPlace) : null
  if (!stops || stops.some((stop) => !stop)) return null
  if (typeof includeTracks !== 'boolean' || typeof handed !== 'boolean') return null
  if (typeof selected !== 'number' || !Number.isInteger(selected) || selected < 0) return null
  if (typeof at !== 'number' || !Number.isFinite(at)) return null
  return { from: start, to: finish, via: stops as HistoryPlace[], includeTracks, selected, at, handed }
}

function parseHistoryPlace(value: unknown): HistoryPlace | null {
  if (typeof value !== 'object' || value === null) return null
  const { here, label, position } = value as Record<string, unknown>
  if (here === true) return { here: true }
  if (typeof label !== 'string' || !isLonLat(position)) return null
  return { label, position }
}
