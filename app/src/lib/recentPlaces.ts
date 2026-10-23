import { haversineM, type LonLat } from './geo'
import type { Place } from './geocoding'
import type { SavedRide } from './savedRide'
import type { HistoryTrip } from './tripHistory'

/** What an empty place field offers: a few places, not a menu. */
export const RECENT_PLACES_MAX = 5
/** Two picks of one town or one café this close together are the same place to the rider. */
export const SAME_PLACE_M = 150

interface Dated {
  place: Place
  at: number
}

/**
 * The places of the rider's recent trips and saved rides, newest first, each once. A trip's finish comes before its start
 * and its stops, as that is where the rider was heading. The rider's own position is never among them, and places near
 * one in `exclude` (the trip's other ends) are left out.
 */
export function recentPlaces(history: HistoryTrip[], saved: SavedRide[], exclude: LonLat[], max = RECENT_PLACES_MAX): Place[] {
  const dated: Dated[] = []
  for (const trip of history) {
    for (const place of [trip.to, trip.from, ...trip.via]) if (!('here' in place)) dated.push({ place: { label: place.label, position: place.position }, at: trip.at })
  }
  for (const ride of saved) {
    for (const place of [ride.to, ride.from, ...ride.via]) dated.push({ place: { label: place.label, position: place.position }, at: ride.savedAt })
  }
  // A stable sort keeps a trip's own order among places of the same moment.
  dated.sort((a, b) => b.at - a.at)
  const near = (a: LonLat, b: LonLat) => haversineM(a, b) < SAME_PLACE_M
  const chosen: Place[] = []
  for (const { place } of dated) {
    if (chosen.length >= max) break
    if (exclude.some((position) => near(position, place.position))) continue
    if (chosen.some((other) => near(other.position, place.position))) continue
    chosen.push(place)
  }
  return chosen
}
