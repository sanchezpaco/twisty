import { splitRoadLabel } from './curves'
import { formatDuration, formatKm } from './format'
import type { Place } from './geocoding'
import type { Messages } from './i18n/en'
import type { RideOption, RideTwisty } from './routing/ride'

/** How many of the ride's known roads the text tells a friend about; the rest is on the map they open. */
const SHARED_ROADS = 2

/** A standard road ref: N-260, A-1605, CV-345, GIV-5221. Local codes like HF04 or SC-22109-01 do not match. */
const STANDARD_REF = /^[A-Z]{1,4}-\d{1,4}$/

/**
 * How a friend knows the road, or null when they would not: a standard ref with its name ("N-260 · Coll de Fadas"), a
 * standard ref alone, or the name alone when the ref is a local code ("SC-22221-03 · Carretera de Arasán").
 */
function knownAs(label: string): string | null {
  const { title, subtitle } = splitRoadLabel(label)
  if (STANDARD_REF.test(title)) return label
  return subtitle
}

/** The best known roads of the ride: highest rating first, then the longest. Anything else tells a friend nothing. */
function bestKnownRoads(twisties: RideTwisty[]): string[] {
  return twisties
    .flatMap((twisty) => {
      const name = knownAs(twisty.label)
      return name === null ? [] : [{ twisty, name }]
    })
    .sort((a, b) => b.twisty.rating - a.twisty.rating || b.twisty.lengthM - a.twisty.lengthM)
    .slice(0, SHARED_ROADS)
    .map(({ name }) => name)
}

/**
 * What the rider sends a friend: where, how long, how curvy, and the Google Maps link as the last line (the link goes in
 * the text and not in the share's `url`, which some apps join to the text a second time).
 */
export function rideShareText(ride: RideOption, from: string, to: string, t: Pick<Messages, 'share' | 'ride' | 'via'>, via: string[] = []): string {
  const roads = bestKnownRoads(ride.twisties)
  return [
    t.share.heading(from, to),
    ...(via.length > 0 ? [t.via.through(via.join(', '))] : []),
    t.share.summary(formatDuration(ride.timeS), formatKm(ride.distanceM), formatKm(ride.twistyM)),
    ...(roads.length > 0 ? [t.share.roads(roads.join(', '))] : []),
    // Whoever opens the link must know the ride has tracks, which Google Maps may not follow.
    ...(ride.trackM > 0 ? [t.ride.tracksLine(formatKm(ride.trackM))] : []),
    ride.googleMapsUrl,
  ].join('\n')
}

/**
 * A ride shared from the rider's live position carries no start (Google Maps starts from the friend's phone), but one
 * that ends there gives its finish away: the rider is warned before it goes.
 */
export function sharesRiderPosition(finish: Place | null | undefined): boolean {
  return finish?.here === true
}
