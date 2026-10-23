import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { LonLat } from '../../src/lib/geo'
import type { KnownRoad } from '../roads'
import type { TripResult } from '../results'
import type { BenchTrip } from '../trips'

/** Every random choice of the kit derives from this one seed and a name, so a choice never depends on the order of a list. */
export const EVAL_SEED = 20261016
export const CONTROL_COUNT = 20
export const SAMPLE_COUNT = 25
/** A found pair whose stop costs within this share of the forced route is that route itself: nothing to judge. */
export const SAME_ROUTE_SHARE = 0.01
/** ...and a control costs at most this many times the forced route, or the judge only measures the extra minutes. */
export const CONTROL_MAX_COST_RATIO = 2.5

/** A trip as the kit froze it: the ends are copied, so a later change to `trips.json` never changes the kit. */
export interface FrozenTrip {
  id: string
  name: string
  from: LonLat
  to: LonLat
}

export interface Pair {
  trip: string
  road: string
}

/** The lists the kit judges on every commit; written once from a bench baseline (`run.js eval-freeze`). */
export interface Frozen {
  seed: number
  /** The baseline the lists come from. */
  from: { commit: string; dataHash: string }
  trips: FrozenTrip[]
  /** The known roads of the pairs as `great-roads.json` had them. */
  roads: KnownRoad[]
  /** Demanded pairs the baseline did not find. */
  misses: Pair[]
  /** Demanded pairs the baseline found. */
  controls: Pair[]
  /** Trips scored on their own, by id. */
  sample: string[]
}

/** The six trips of the head-to-head study (`reviews/2026-10-15-head-to-head.md`); the sample always holds them. */
export const HEAD_TO_HEAD_TRIPS: FrozenTrip[] = [
  { id: 'h2h-t1', name: 'València → Los Santos de Maimona', from: [-0.3763, 39.4699], to: [-6.3818, 38.4494] },
  { id: 'h2h-t2', name: 'Madrid → Granada', from: [-3.7035, 40.4168], to: [-3.5995, 37.1735] },
  { id: 'h2h-t3', name: 'Jaca → Benasque', from: [-0.5494, 42.5693], to: [0.5237, 42.6053] },
  { id: 'h2h-t4', name: 'Santander → Oviedo', from: [-3.81, 43.4619], to: [-5.8484, 43.3619] },
  { id: 'h2h-t5', name: 'Madrid → Plasencia', from: [-3.7035, 40.4168], to: [-6.0902, 40.0299] },
  { id: 'h2h-t6', name: 'València → Alicante', from: [-0.3763, 39.4697], to: [-0.4882, 38.3436] },
]

/** A 32-bit hash that mixes every character: the short hash of `random.ts` leaves ids that differ in their last digits clustered. */
export const hash32 = (text: string): number => createHash('sha256').update(text).digest().readUInt32BE(0)

const itemId = (text: string): string => `p-${hash32(text).toString(16).padStart(8, '0')}`

export const pairId = ({ trip, road }: Pair, seed = EVAL_SEED): string => itemId(`${seed}:pair:${trip}:${road}`)

/** An added pair is drawn apart from the frozen ones: a control that became a miss would otherwise be two items under one
 * id. Same prefix, so the judge cannot tell the lists apart. */
export const addedPairId = ({ trip, road }: Pair, seed = EVAL_SEED): string => itemId(`${seed}:added:${trip}:${road}`)

/** Items sorted by a hash of their name: a shuffle that does not change when other items come or go. */
export function ranked<T>(items: T[], purpose: string, name: (item: T) => string, seed = EVAL_SEED): T[] {
  return items
    .map((item) => ({ item, rank: hash32(`${seed}:${purpose}:${name(item)}`) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item)
}

const frozenTrip = (trip: BenchTrip): FrozenTrip => ({ id: trip.id, name: `${trip.fromName} → ${trip.toName}`, from: trip.from, to: trip.to })

interface FreezeInput {
  baseline: { header: { commit: string; dataHash: string }; results: Pick<TripResult, 'id' | 'greatRoads'>[] }
  trips: BenchTrip[]
  roads: KnownRoad[]
}

/** Picks the lists from a bench baseline: all its misses, a seeded sample of its finds, a seeded sample of trips. */
export function freeze({ baseline, trips, roads }: FreezeInput): Frozen {
  const demanded = baseline.results.flatMap((result) =>
    Object.entries(result.greatRoads)
      .filter(([, great]) => great.demanded)
      .map(([road, great]) => ({ pair: { trip: result.id, road }, found: great.foundAt !== null, costRatio: great.costRatio })),
  )
  const bySortKey = (a: Pair, b: Pair) => `${a.trip}|${a.road}`.localeCompare(`${b.trip}|${b.road}`)
  const misses = demanded.filter(({ found }) => !found).map(({ pair }) => pair).sort(bySortKey)
  // A control is a found pair whose stop is not the forced route itself (the judge would compare a route with itself)
  // and not far dearer than it.
  const found = demanded
    .filter(({ found, costRatio }) => found && costRatio !== null && costRatio > 0 && Math.abs(costRatio - 1) > SAME_ROUTE_SHARE && costRatio <= CONTROL_MAX_COST_RATIO)
    .map(({ pair }) => pair)
  const controls = ranked(found, 'control', (pair) => pairId(pair)).slice(0, CONTROL_COUNT).sort(bySortKey)

  // The fixed trips are two of the head-to-head trips under another name.
  const plannable = trips.filter((trip) => !trip.includeTracks && trip.kind !== 'fixed')
  const drawn = ranked(plannable, 'sample', (trip) => trip.id).slice(0, SAMPLE_COUNT - HEAD_TO_HEAD_TRIPS.length)
  const frozenTrips = new Map<string, FrozenTrip>()
  const add = (trip: BenchTrip) => frozenTrips.set(trip.id, frozenTrip(trip))
  const byId = new Map(trips.map((trip) => [trip.id, trip]))
  for (const pair of [...misses, ...controls]) add(byId.get(pair.trip) as BenchTrip)
  drawn.forEach(add)
  for (const trip of HEAD_TO_HEAD_TRIPS) frozenTrips.set(trip.id, trip)

  const roadIds = new Set([...misses, ...controls].map((pair) => pair.road))
  return {
    seed: EVAL_SEED,
    from: baseline.header,
    trips: [...frozenTrips.values()].sort((a, b) => a.id.localeCompare(b.id)),
    roads: roads.filter((road) => roadIds.has(road.id)),
    misses,
    controls,
    sample: [...HEAD_TO_HEAD_TRIPS, ...drawn].map((trip) => trip.id).sort(),
  }
}

/** Misses of a later run that the frozen list does not hold, with the trips and roads they need. */
export interface Added {
  trips: FrozenTrip[]
  roads: KnownRoad[]
  pairs: Pair[]
}

export const NOTHING_ADDED: Added = { trips: [], roads: [], pairs: [] }

/** The demanded pairs of `results` that no stop rides and the frozen list does not have, to be judged as a second list. */
export function addedMisses(frozen: Frozen, results: Pick<TripResult, 'id' | 'greatRoads'>[], trips: BenchTrip[], roads: KnownRoad[]): Added {
  const old = new Set(frozen.misses.map((pair) => pairId(pair, frozen.seed)))
  const pairs = results
    .flatMap((result) =>
      Object.entries(result.greatRoads)
        .filter(([, great]) => great.demanded && great.foundAt === null)
        .map(([road]) => ({ trip: result.id, road })),
    )
    .filter((pair) => !old.has(pairId(pair, frozen.seed)))
  const [tripIds, roadIds] = [new Set(pairs.map((pair) => pair.trip)), new Set(pairs.map((pair) => pair.road))]
  return {
    trips: trips.filter((trip) => tripIds.has(trip.id)).map(frozenTrip),
    roads: roads.filter((road) => roadIds.has(road.id)),
    pairs,
  }
}

export function readFrozen(path: string): Frozen {
  const frozen = JSON.parse(readFileSync(path, 'utf8')) as Frozen
  const known = new Set(frozen.trips.map((trip) => trip.id))
  const roads = new Set(frozen.roads.map((road) => road.id))
  for (const pair of [...frozen.misses, ...frozen.controls]) {
    if (!known.has(pair.trip)) throw new Error(`The frozen pair ${pair.trip} / ${pair.road} names a trip that is not frozen`)
    if (!roads.has(pair.road)) throw new Error(`The frozen pair ${pair.trip} / ${pair.road} names a road that is not frozen`)
  }
  for (const id of frozen.sample) if (!known.has(id)) throw new Error(`The frozen sample trip ${id} is not frozen`)
  return frozen
}

const isLonLat = (value: unknown): boolean => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)

/** A file of trips for `eval --trips`, checked: a malformed file fails here, not halfway through a dossier. */
export function readTripsFile(path: string): { seed: number; trips: FrozenTrip[] } {
  const file = JSON.parse(readFileSync(path, 'utf8'))
  if (!Number.isInteger(file?.seed)) throw new Error(`${path}: the seed must be an integer`)
  if (!Array.isArray(file.trips) || file.trips.length === 0) throw new Error(`${path}: the trips must be a list of at least one trip`)
  const ids = new Set<string>()
  for (const trip of file.trips) {
    if (typeof trip?.id !== 'string' || typeof trip.name !== 'string' || !isLonLat(trip.from) || !isLonLat(trip.to)) {
      throw new Error(`${path}: every trip needs an id, a name and its ends as [lon, lat]: ${JSON.stringify(trip)}`)
    }
    if (ids.has(trip.id)) throw new Error(`${path}: the trip ${trip.id} is listed twice`)
    ids.add(trip.id)
  }
  return { seed: file.seed, trips: file.trips.map(({ id, name, from, to }: FrozenTrip) => ({ id, name, from, to })) }
}
