import type { RideTwisty } from './routing/ride'

export const RATINGS = [1, 2, 3, 4, 5] as const

/** Narrow metres below this are noise from a short way, not a road the rider should be warned about. */
export const NARROW_CHIP_MIN_M = 500
/** An unnamed link shorter than this (a junction, a slip, a village lane) is left out of a twisty's roads: it reads as a data hole. */
export const UNNAMED_LINK_MAX_M = 2_000
/** The closure note names this many roads at most; more would bury the sentence, so it speaks of "some roads". */
const NAMED_CLOSURES_MAX = 2

/** Km of twisties at each rating, index = rating - 1. */
export function lengthByRating(twisties: RideTwisty[]): number[] {
  const lengths = RATINGS.map(() => 0)
  for (const twisty of twisties) lengths[twisty.rating - 1] += twisty.lengthM
  return lengths
}

/** The rating with the most km on this ride, or null on a ride without twisties. */
export function dominantRating(twisties: RideTwisty[]): number | null {
  const lengths = lengthByRating(twisties)
  const most = Math.max(...lengths)
  return most > 0 ? lengths.indexOf(most) + 1 : null
}

/** The roads the closure note names, by ref (or name); none when there are too many to name, or the ride does not know them. */
export function namedClosures(closedRoads: string[] = []): string[] {
  const roads = closedRoads.map((label) => splitRoadLabel(label).title)
  return roads.length <= NAMED_CLOSURES_MAX ? roads : []
}

/** "CV-345 · Carretera de Villar a La Yesa" → the ref to lead with and the name to show below it. */
export function splitRoadLabel(label: string): { title: string; subtitle: string | null } {
  const [title, ...rest] = label.split(' · ')
  return { title, subtitle: rest.length > 0 ? rest.join(' · ') : null }
}

/**
 * The roads a twisty chains, in riding order, each by its ref (or name) and its own km, so no road reads longer than it
 * is; null for a twisty on one road, and for rides saved before the roads were kept.
 */
export function twistyRoads(twisty: RideTwisty, unnamed: string): { title: string; lengthM: number }[] | null {
  const roads = (twisty.roads ?? []).filter(({ label, lengthM }) => label !== '' || lengthM >= UNNAMED_LINK_MAX_M)
  if (roads.length < 2) return null
  return roads.map(({ label, lengthM }) => ({ title: label ? splitRoadLabel(label).title : unnamed, lengthM }))
}

export interface ListedTwisty {
  twisty: RideTwisty
  /** Its place in riding order, which the map's badges use too. */
  number: number
  /** The road this stop was given so that a great road is not left out of the slider. */
  added: boolean
}

/**
 * The twisties as the summary lists them: in riding order, except that the road a coverage stop adds comes first, so the
 * rider sees at once why this stop exists. The road is told by the index of its twisty; a ride saved before options had
 * one tells it by its label, or by its ref when the two were labelled apart.
 */
export function listedTwisties(twisties: RideTwisty[], coverageRoad: string | null, coverageTwisty?: number): ListedTwisty[] {
  const listed = twisties.map((twisty, index) => ({ twisty, number: index + 1, added: false }))
  if (coverageRoad === null) return listed
  const ref = splitRoadLabel(coverageRoad).title
  const at = coverageTwisty ?? listed.findIndex(({ twisty }) => twisty.label === coverageRoad)
  const found = at >= 0 ? at : listed.findIndex(({ twisty }) => splitRoadLabel(twisty.label).title === ref)
  if (found < 0) return listed
  const [road] = listed.splice(found, 1)
  return [{ ...road, added: true }, ...listed]
}

export interface RoadWarnings {
  /** Lowest posted limit, when the road is signed 40 km/h or less over a stretch worth mentioning. */
  postedKmh: number | null
  narrowM: number | null
  ford: boolean
  /** Some of it closes to motor traffic part of the year. */
  closed: boolean
}

/** What the rider should know about a twisty before riding it; each field is absent when there is nothing to say. */
export function roadWarnings(twisty: RideTwisty): RoadWarnings {
  return {
    postedKmh: twisty.postedKmh,
    narrowM: twisty.narrowM >= NARROW_CHIP_MIN_M ? twisty.narrowM : null,
    ford: twisty.fordCount > 0,
    closed: twisty.closedPartOfYear === true,
  }
}

export const hasWarning = ({ postedKmh, narrowM, ford, closed }: RoadWarnings) => postedKmh !== null || narrowM !== null || ford || closed
