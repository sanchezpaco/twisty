import type { Graph } from '../src/lib/data/graph'
import type { EdgeWeights } from '../src/lib/routing/edgeWeights'
import type { ShortestPaths } from '../src/lib/routing/shortestPaths'
import { haversineM } from '../src/lib/geo'
import type { RideOption } from '../src/lib/routing/ride'
import { TOWN_NEAR_M, type TripChecks } from './checks'
import { backtrackM, type PlaceIndex, regressM, revisitedNodes, rideLine, sharpTurns, slowDullM, straightInTwistyM, suspiciousM, townWrongWay } from './metrics'
import { type City, cityCentreKm, sideLoops } from './defects'
import { pinFidelity, type PinTools, urlWaypoints } from './pins'
import type { OptionRecord } from './results'
import type { BenchTrip } from './trips'

/** A ratio with nothing to divide by, kept finite so that it survives JSON. */
export const NO_TWISTY_GAIN = 999
const FASTEST_SPEED_MIN_TRIP_M = 100_000

export interface CheckTools {
  places?: PlaceIndex
  pins?: PinTools
  /** The cities of the places file, for R16. */
  cities?: City[]
  /** A search and the weights to run it with, for R17. */
  loops?: { searches: ShortestPaths; weights: EdgeWeights }
}

/** The numbers of the route sanity checks (R1-R14) for the options of a trip. */
export function tripChecks(
  graph: Graph,
  trip: BenchTrip,
  options: RideOption[],
  records: OptionRecord[],
  start: number,
  stops: number[],
  tools: CheckTools,
): TripChecks {
  const [fastest] = records
  const straightM = haversineM(trip.from, trip.to)
  const lines = options.map((option) => rideLine(graph, option.edges, start))
  const towns = options.map((_, index) => tools.places?.near(lines[index], TOWN_NEAR_M) ?? new Set<number>())
  const slowDull = options.map((option) => slowDullM(graph, option.edges))
  const regress = lines.map((line) => regressM(line, trip.to))
  const labels = records.map((record) => new Set(record.twisties.map(([label]) => label)))
  const twistyGainM = (index: number, from = 0) => records[index].benchTwistyM - records[from].benchTwistyM
  const perTwistyKm = (gainedM: number, twistyM: number) => (gainedM <= 0 ? 0 : twistyM <= 0 ? NO_TWISTY_GAIN : Math.min(NO_TWISTY_GAIN, gainedM / twistyM))
  const transitM = (record: OptionRecord) => record.distanceM - record.benchTwistyM
  const townWrong = options.map((option) => townWrongWay(graph, option.edges, start, urlWaypoints(option.googleMapsUrl)))

  return {
    backtrackM: options.map((option) => backtrackM(graph, option.edges)),
    revisited: options.map((option) => revisitedNodes(graph, option.edges, start)),
    fastestDetour: fastest.distanceM / straightM,
    transitPerTwistyKm: records.map((record, i) => (i === 0 ? null : perTwistyKm(transitM(record) - transitM(fastest), twistyGainM(i)))),
    fastestKmh: straightM >= FASTEST_SPEED_MIN_TRIP_M ? (fastest.distanceM / fastest.timeS) * 3.6 : null,
    slowDullExtraM: slowDull.map((metres) => metres - slowDull[0]),
    townsExtra: towns.map((near) => [...near].filter((place) => !towns[0].has(place)).length),
    thinStop: records.map((record, i) => i > 0 && (twistyGainM(i, i - 1) < 2_000 || (record.timeS - records[i - 1].timeS) / 60 / (twistyGainM(i, i - 1) / 1000) > 5)),
    sameRoads: records.map((_, i) => i > 0 && [...labels[i]].every((label) => labels[i - 1].has(label))),
    suspiciousM: options.map((option) => suspiciousM(graph, option.edges)),
    timeError: trip.referenceTimeS ? Math.abs(fastest.timeS - trip.referenceTimeS) / trip.referenceTimeS : null,
    regressPerTwistyKm: records.map((_, i) => (i === 0 ? null : perTwistyKm(regress[i] - regress[0], twistyGainM(i)))),
    straightInTwistyM: options.map((option) => straightInTwistyM(graph, option.edges)),
    cityCentreKm: options.map((option) => (tools.cities ? cityCentreKm(graph, option.edges, tools.cities, [trip.from, trip.to]) : {})),
    sharpTurns: options.map((option) => sharpTurns(graph, option.edges, start)),
    townWrongWayM: townWrong.map(({ metres }) => metres),
    townWrongWaypoints: townWrong.map(({ waypoints }) => waypoints),
    sideLoops: options.map((option) => (tools.loops ? sideLoops(graph, option.edges, start, tools.loops.searches, tools.loops.weights.use(0, trip.includeTracks)) : [])),
    pinFidelity: Object.fromEntries(
      [...new Set(stops)].map((stop) => [
        stop,
        tools.pins ? pinFidelity(tools.pins, options[stop].twisties, options[stop].googleMapsUrl, trip.from, trip.to) : null,
      ]),
    ),
  }
}
