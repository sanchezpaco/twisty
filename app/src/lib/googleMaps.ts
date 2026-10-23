import { cumulativeDistancesM, type LonLat, pointAlong } from './geo'

/** Google Maps directions URLs accept at most 9 waypoints (3 in mobile browsers; the app gets 9). */
export const MAX_WAYPOINTS = 9
/** The rider's stops between start and finish: each one is a waypoint, and the twisty pins share what is left. */
export const MAX_VIA = 3
/** Pins sit slightly inside each twisty so Google does not snap them onto the crossing road. */
const PIN_INSET_M = 250
/** Long twisties get extra pins so Google cannot shortcut them through a faster valley road. */
const PIN_SPACING_M = 12_000
/** Pins keep this far along the line from a kept-out stretch, so Google does not snap them onto it at the junction. */
const PIN_CLEARANCE_M = 30

/** A twisty to pin, and the stretches of its line no pin may sit on, as [first, last] vertex indices. */
export interface PinLine {
  line: LonLat[]
  keepOut: [number, number][]
}

/** The pins of one twisty in riding order; `complete` when both its entry and its exit got one. */
export interface TwistyPins {
  pins: LonLat[]
  complete: boolean
}

/** Entry and exit pins for every twisty, plus interior pins on the longest ones while waypoints remain. */
export function twistyPins(lines: PinLine[], maxWaypoints = MAX_WAYPOINTS): TwistyPins[] {
  const measured = lines.map(({ line, keepOut }) => {
    const cumulative = cumulativeDistancesM(line)
    return { line, cumulative, keepOut: keepOut.map(([first, last]): [number, number] => [cumulative[first], cumulative[last]]) }
  })
  const lengths = measured.map(({ cumulative }) => cumulative[cumulative.length - 1])
  const interior = lengths.map(() => 0)
  let spare = maxWaypoints - 2 * lines.length
  while (spare > 0) {
    const candidates = lengths
      .map((length, i) => ({ i, gap: length / (interior[i] + 1) }))
      .filter(({ gap }) => gap > PIN_SPACING_M)
    if (candidates.length === 0) break
    const widest = candidates.reduce((a, b) => (b.gap > a.gap ? b : a))
    interior[widest.i]++
    spare--
  }
  return measured.map(({ line, cumulative, keepOut }, i) => {
    const length = lengths[i]
    const inset = Math.min(PIN_INSET_M, length / 4)
    const interiorAt = Array.from({ length: interior[i] }, (_, k) => (length * (k + 1)) / (interior[i] + 1))
    const at = [inset, ...interiorAt, length - inset].map((distanceM) => clearOf(distanceM, keepOut, length))
    return {
      pins: at.filter((distanceM) => distanceM !== null).map((distanceM) => pointAlong(line, distanceM, cumulative)),
      complete: at[0] !== null && at[at.length - 1] !== null,
    }
  })
}

/** The distance nearest to `distanceM` on the line and clear of every kept-out stretch, or null when none is. */
function clearOf(distanceM: number, keepOut: [number, number][], length: number): number | null {
  const blocked = keepOut.map(([from, to]) => [from - PIN_CLEARANCE_M, to + PIN_CLEARANCE_M])
  const clear = [distanceM, ...blocked.flat()].filter(
    (d) => d >= 0 && d <= length && !blocked.some(([from, to]) => d > from && d < to),
  )
  if (clear.length === 0) return null
  return clear.reduce((best, d) => (Math.abs(d - distanceM) < Math.abs(best - distanceM) ? d : best))
}

/** Without an `origin`, Google Maps starts from the phone's location: a link shared on from it carries no home position. */
export function googleMapsDirectionsUrl(origin: LonLat | null, destination: LonLat, waypoints: LonLat[]): string {
  const params = new URLSearchParams({ api: '1' })
  if (origin) params.set('origin', latLon(origin))
  params.set('destination', latLon(destination))
  params.set('travelmode', 'driving')
  if (waypoints.length > 0) params.set('waypoints', waypoints.slice(0, MAX_WAYPOINTS).map(latLon).join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}

function latLon([lon, lat]: LonLat): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`
}
