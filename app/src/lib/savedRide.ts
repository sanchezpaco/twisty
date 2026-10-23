import { isLonLat, type LonLat } from './geo'
import { decodeLine, encodeLine } from './polyline'
import type { RideOption, RideTwisty, RouteSegment } from './routing/ride'

/** A place of a saved ride, as the rider named it. */
export interface SavedPlace {
  label: string
  position: LonLat
}

type StoredSegment = Omit<RouteSegment, 'line'> & { line: string }
type StoredTwisty = Omit<RideTwisty, 'line'> & { line: string }

/** The ride as it was on screen, with its lines encoded; `edges` are left out, they only mean something to one graph. */
export type StoredRide = Omit<RideOption, 'edges' | 'segments' | 'twisties'> & { segments: StoredSegment[]; twisties: StoredTwisty[] }

/** A ride the rider kept: it never changes, whatever data the app plans with later. */
export interface SavedRide {
  id: string
  name: string
  /** Null: not in a folder. */
  folderId: string | null
  /** In ms since the epoch. */
  savedAt: number
  from: SavedPlace
  to: SavedPlace
  /** The stops between them, in riding order. */
  via: SavedPlace[]
  /** `generatedAt` of the data it was planned with, when known. */
  dataAt: string | null
  ride: StoredRide
}

export type SavedRideFields = Omit<SavedRide, 'ride'>

const SEGMENT_KINDS = new Set<RouteSegment['kind']>(['transit', 'twisty', 'track'])
const NUMBERS = ['timeS', 'extraS', 'distanceM', 'curvyM', 'twistyM', 'motorwayM', 'trackM', 'otherM'] as const

export function savedRideOf(option: RideOption, fields: SavedRideFields): SavedRide {
  const { edges: _edges, segments, twisties, ...rest } = option
  return {
    ...fields,
    ride: {
      ...rest,
      segments: segments.map((segment) => ({ ...segment, line: encodeLine(segment.line) })),
      twisties: twisties.map((twisty) => ({ ...twisty, line: encodeLine(twisty.line) })),
    },
  }
}

/** The ride to show and hand over again, exactly as it was saved. */
export function rideOfSaved({ ride }: SavedRide): RideOption {
  return {
    ...ride,
    edges: [],
    segments: ride.segments.map((segment) => ({ ...segment, line: decodeLine(segment.line) })),
    twisties: ride.twisties.map((twisty) => ({ ...twisty, line: decodeLine(twisty.line) })),
  }
}

/**
 * Whether two rides are the same: the same Google Maps link through the same points. Names are not compared: a ride
 * from "My location" is saved under the town it starts in.
 */
export function isSameRide(saved: SavedRide, option: RideOption, from: SavedPlace, to: SavedPlace, via: SavedPlace[]): boolean {
  const places = [saved.from, ...saved.via, saved.to]
  const others = [from, ...via, to]
  return (
    saved.ride.googleMapsUrl === option.googleMapsUrl &&
    places.length === others.length &&
    places.every((place, i) => place.position[0] === others[i].position[0] && place.position[1] === others[i].position[1])
  )
}

/** A stored saved ride, or null when anything in it is not what this version writes. */
export function parseSavedRide(value: unknown): SavedRide | null {
  if (!isRecord(value)) return null
  const { id, name, folderId, savedAt, from, to, via, dataAt, ride } = value
  if (typeof id !== 'string' || typeof name !== 'string') return null
  if (folderId !== null && typeof folderId !== 'string') return null
  if (!isFiniteNumber(savedAt)) return null
  if (dataAt !== null && typeof dataAt !== 'string') return null
  const start = parsePlace(from)
  const finish = parsePlace(to)
  const stops = Array.isArray(via) ? via.map(parsePlace) : null
  if (!start || !finish || !stops || stops.some((stop) => stop === null)) return null
  const stored = parseStoredRide(ride)
  if (!stored) return null
  return { id, name, folderId, savedAt, from: start, to: finish, via: stops as SavedPlace[], dataAt, ride: stored }
}

function parseStoredRide(value: unknown): StoredRide | null {
  if (!isRecord(value)) return null
  if (!NUMBERS.every((key) => isFiniteNumber(value[key]))) return null
  const { googleMapsUrl, coverageRoad, segments, twisties } = value
  if (typeof googleMapsUrl !== 'string' || (coverageRoad !== null && typeof coverageRoad !== 'string')) return null
  if (!Array.isArray(segments) || !segments.every(isStoredSegment)) return null
  if (!Array.isArray(twisties) || !twisties.every(isStoredTwisty)) return null
  if (![...segments, ...twisties].every(({ line }) => decodes(line))) return null
  const { legs, pinnedAll } = value
  if (legs !== undefined && !(Array.isArray(legs) && legs.length > 0 && legs.every(isLeg))) return null
  if (pinnedAll !== undefined && typeof pinnedAll !== 'boolean') return null
  const { fordCount, closedPartOfYear, closedRoads } = value
  if (!(fordCount === undefined || isFiniteNumber(fordCount)) || !isOptionalBoolean(closedPartOfYear)) return null
  if (!(closedRoads === undefined || (Array.isArray(closedRoads) && closedRoads.every((road) => typeof road === 'string')))) return null
  const stored = value as unknown as StoredRide
  // A ride saved before trips had stops is one leg, every twisty in it; whether Google Maps got every twisty's pins was
  // not kept, so the ride does not claim it.
  return {
    ...stored,
    legs: legs ? stored.legs : [{ timeS: stored.timeS, distanceM: stored.distanceM, twistyM: stored.twistyM, curvyM: stored.curvyM }],
    pinnedAll: pinnedAll ?? false,
    twisties: stored.twisties.map((twisty) => ({ ...twisty, leg: twisty.leg ?? 0 })),
  }
}

function isLeg(value: unknown): boolean {
  return isRecord(value) && ['timeS', 'distanceM', 'twistyM', 'curvyM'].every((key) => isFiniteNumber(value[key]))
}

function isStoredSegment(value: unknown): value is StoredSegment {
  if (!isRecord(value)) return false
  const { kind, line, rating } = value
  return SEGMENT_KINDS.has(kind as RouteSegment['kind']) && typeof line === 'string' && (rating === undefined || isFiniteNumber(rating))
}

function isStoredTwisty(value: unknown): value is StoredTwisty {
  if (!isRecord(value)) return false
  const { label, lengthM, rating, narrowM, postedKmh, fordCount, closedPartOfYear, roads, line, leg } = value
  return (
    typeof label === 'string' &&
    typeof line === 'string' &&
    [lengthM, rating, narrowM, fordCount].every(isFiniteNumber) &&
    (postedKmh === null || isFiniteNumber(postedKmh)) &&
    (leg === undefined || isFiniteNumber(leg)) &&
    isOptionalBoolean(closedPartOfYear) &&
    (roads === undefined || (Array.isArray(roads) && roads.every(isRoad)))
  )
}

function decodes(line: string): boolean {
  try {
    decodeLine(line)
    return true
  } catch {
    return false
  }
}

function parsePlace(value: unknown): SavedPlace | null {
  if (!isRecord(value)) return null
  const { label, position } = value
  return typeof label === 'string' && isLonLat(position) ? { label, position } : null
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isOptionalBoolean = (value: unknown): boolean => value === undefined || typeof value === 'boolean'
const isRoad = (value: unknown): boolean => isRecord(value) && typeof value.label === 'string' && isFiniteNumber(value.lengthM)
