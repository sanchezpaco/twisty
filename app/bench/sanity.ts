import {
  EMPTY_SLIDER_MAX_STOPS,
  EMPTY_SLIDER_MIN_TRIP_KM,
  FASTEST_DETOUR_MAX,
  FASTEST_KMH_RANGE,
  PIN_FIDELITY_MIN,
  REGRESS_PER_TWISTY_KM_MAX,
  SLOW_DULL_EXTRA_MAX_M,
  CITY_CENTRE_EXTRA_KM,
  CITY_CENTRE_RADIUS_M,
  LOOP_LOW_RETURN_KM_PER_MIN,
  LOOP_WASTE_MIN_S,
  STRAIGHT_IN_TWISTY_MAX_M,
  SUSPICIOUS_MAX_M,
  THIN_STOP_MAX_MIN_PER_TWISTY_KM,
  THIN_STOP_MIN_TWISTY_M,
  TIME_ERROR_MAX,
  TOWN_NEAR_M,
  TOWNS_CROSSED_MAX,
  TRANSIT_PER_TWISTY_MAX,
  violations,
  type Violation,
} from './checks'
import { haversineM } from '../src/lib/geo'
import type { TripResult } from './results'
import type { BenchTrip } from './trips'

/** The sanity checks, in the order of the design, with the rule each one applies. */
export const SANITY_CHECKS: [check: string, rule: string][] = [
  ['R1 backtrackM', 'an edge ridden twice'],
  ['R2 loops', 'a node visited twice'],
  ['R3 fastestDetour', `fastest route over ${FASTEST_DETOUR_MAX}× the straight line`],
  ['R4 transitPerTwisty', `more than ${TRANSIT_PER_TWISTY_MAX} km of other road gained per twisty km gained`],
  ['R5 fastestSpeed', `trips over 100 km: average outside ${FASTEST_KMH_RANGE[0]}-${FASTEST_KMH_RANGE[1]} km/h`],
  ['R6 slowDullExtra', `${SLOW_DULL_EXTRA_MAX_M / 1000} km more slow dull road than the fastest`],
  ['R6b townsCrossed', `more than ${TOWNS_CROSSED_MAX} places within ${TOWN_NEAR_M / 1000} km that the fastest does not pass`],
  ['R7 thinStops', `a step buying under ${THIN_STOP_MIN_TWISTY_M / 1000} twisty km or over ${THIN_STOP_MAX_MIN_PER_TWISTY_KM} min per km`],
  ['R8 sameRoads', 'a stop with no road the stop before lacks'],
  ['R9 emptySlider', `trips over ${EMPTY_SLIDER_MIN_TRIP_KM} km with ${EMPTY_SLIDER_MAX_STOPS} stops or fewer that are mountain or have a demanded road`],
  ['R10 suspiciousNames', `${SUSPICIOUS_MAX_M / 1000} km of tarmac named like a track`],
  ['R11 timeError', `fastest time ${TIME_ERROR_MAX * 100}% off the reference`],
  ['R12 regressKm', `more than ${REGRESS_PER_TWISTY_KM_MAX} km ridden away from B per twisty km gained`],
  ['R13 pinFidelity', `the pinned route rides under ${PIN_FIDELITY_MIN * 100}% of the twisty km (default and max-curves stops)`],
  ['R14 straightInTwisty', `more than ${STRAIGHT_IN_TWISTY_MAX_M / 1000} km of dull road inside one twisty`],
  ['R16 cityCentre', `${CITY_CENTRE_EXTRA_KM} km more road that is not fast within ${CITY_CENTRE_RADIUS_M / 1000} km of a city's centre than the fastest`],
  ['R17 dominatedLoop', `a side loop of ${LOOP_WASTE_MIN_S / 60} min or more that buys no fun over the fastest way between its ends`],
  ['R17b lowReturnLoop', `a side loop of ${LOOP_WASTE_MIN_S / 60} min or more buying under ${LOOP_LOW_RETURN_KM_PER_MIN} fun km per minute it adds`],
]

/** The violations of one trip's numbers. */
export function tripViolations(result: TripResult, trip: BenchTrip): Violation[] {
  if (!result.checks) return []
  const tripKm = haversineM(trip.from, trip.to) / 1000
  const hasDemandedRoad = Object.values(result.greatRoads).some((pair) => pair.demanded)
  return violations(result.checks, result.options.length, tripKm, trip.tags?.includes('mountain') === true || hasDemandedRoad)
}

export interface CheckRow {
  check: string
  rule: string
  trips: number
  stops: number
  atDefaultStop: number
  newTrips: number
  fixedTrips: number
}

/** Per check: how many trips and stops break it now, at the default stop, and what is new or fixed since the baseline. */
export function checkRows(results: TripResult[], trips: Map<string, BenchTrip>, baseline: Map<string, TripResult> | null): CheckRow[] {
  const now = results.map((result) => ({ result, found: tripViolations(result, trips.get(result.id) as BenchTrip) }))
  return SANITY_CHECKS.map(([check, rule]) => {
    const mine = now.map(({ result, found }) => ({ result, found: found.filter((violation) => violation.check === check) }))
    const violating = mine.filter(({ found }) => found.length > 0)
    const was = (id: string): boolean | null => {
      const before = baseline?.get(id)
      return before ? tripViolations(before, trips.get(id) as BenchTrip).some((violation) => violation.check === check) : null
    }
    return {
      check,
      rule,
      trips: violating.length,
      stops: violating.reduce((sum, { found }) => sum + found.filter((violation) => violation.stop !== null).length, 0),
      atDefaultStop: violating.filter(({ result, found }) => found.some((violation) => violation.stop === result.defaultStop)).length,
      newTrips: mine.filter(({ result, found }) => found.length > 0 && was(result.id) === false).length,
      fixedTrips: mine.filter(({ result, found }) => found.length === 0 && was(result.id) === true).length,
    }
  })
}

/** The trips with most violations, for the "worst trips" list. */
export function worstTrips(results: TripResult[], trips: Map<string, BenchTrip>, limit = 10): { id: string; count: number; checks: string[] }[] {
  return results
    .map((result) => {
      const found = tripViolations(result, trips.get(result.id) as BenchTrip)
      return { id: result.id, count: found.length, checks: [...new Set(found.map((violation) => violation.check.split(' ')[0]))] }
    })
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
