import { GREAT_ROAD_DEMAND_S, GREAT_ROAD_REPORT_S } from './greatRoads'
import type { RoadStatus } from './roads'
import { checkRows, worstTrips } from './sanity'
import type { TripResult } from './results'
import type { BenchTrip } from './trips'

export interface RunInfo {
  label: string
  dataHash: string
  workers: number
  wallS: number
}

export interface Summary extends RunInfo {
  trips: number
  failures: number
  settled: { mean: number; p95: number }
  ms: { median: number; p95: number }
}

const percentile = (values: number[], share: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0
}

export function summarise(info: RunInfo, results: TripResult[]): Summary {
  const settled = results.map((result) => result.settled)
  return {
    ...info,
    trips: results.length,
    failures: results.reduce((sum, result) => sum + result.failures.length, 0),
    settled: { mean: settled.reduce((a, b) => a + b, 0) / Math.max(1, settled.length), p95: percentile(settled, 0.95) },
    ms: { median: percentile(results.map((result) => result.ms), 0.5), p95: percentile(results.map((result) => result.ms), 0.95) },
  }
}

const thousands = (value: number) => `${Math.round(value / 1000).toLocaleString('en')}k`

export function renderReport(
  summary: Summary,
  trips: BenchTrip[],
  results: TripResult[],
  runFailures: string[],
  roads: RoadStatus[],
  diff: string[] = [],
  baseline: Map<string, TripResult> | null = null,
): string {
  const byId = new Map(trips.map((trip) => [trip.id, trip]))
  const failing = results.flatMap((result) => result.failures.map((failure) => `- \`${result.id}\` ${failure}`))
  const rows = results.map((result) => {
    const trip = byId.get(result.id)
    const stop = result.options[result.defaultStop]
    return `| ${result.id} | ${trip?.kind} | ${trip?.set} | ${result.options.length} | ${stop ? Math.round(stop.extraS / 60) : '-'} | ${Math.round(result.ms)} | ${thousands(result.settled)} | ${result.failures.length} |`
  })
  return [
    `# Bench report ${summary.label}`,
    '',
    `Data \`${summary.dataHash}\` · ${summary.trips} trips · ${summary.workers} workers · ${summary.wallS.toFixed(0)} s`,
    '',
    '## Failures',
    '',
    ...(failing.length + runFailures.length === 0 ? ['None.'] : [...runFailures.map((failure) => `- ${failure}`), ...failing]),
    '',
    ...greatRoadSection(roads, byId, results),
    ...diff,
    ...sanitySection(results, byId, baseline),
    ...modelRecallSection(results),
    ...coverageSection(results),
    '## Cost',
    '',
    `Settled nodes per plan: mean ${thousands(summary.settled.mean)}, p95 ${thousands(summary.settled.p95)}. ` +
      `Mac milliseconds: median ${Math.round(summary.ms.median)}, p95 ${Math.round(summary.ms.p95)}.`,
    '',
    '## Trips',
    '',
    '| Trip | Kind | Set | Stops | Default stop (+min) | ms | Settled | Failures |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n')
}

// A step between two stops this many times the median step of its trip reads as a gap in the slider.
const LUMPY_STEP_RATIO = 6

/** Coverage stops (report only): the trips that have one, and the trips whose slider has a lumpy step in time. */
function coverageSection(results: TripResult[]): string[] {
  const swaps = results.flatMap((result) =>
    result.options.flatMap((stop) => (stop.coverageRoad ? [`- \`${result.id}\`: ${stop.coverageRoad}, +${Math.round(stop.extraS / 60)} min`] : [])),
  )
  const lumpy = results.flatMap((result) => {
    const steps = result.options.slice(1).map((stop, i) => Math.round((stop.timeS - result.options[i].timeS) / 60))
    const median = [...steps].sort((a, b) => a - b)[Math.floor(steps.length / 2)]
    return steps.length >= 3 && Math.max(...steps) > LUMPY_STEP_RATIO * Math.max(1, median) ? [`- \`${result.id}\`: steps ${steps.join(', ')} min`] : []
  })
  return [
    '## Coverage stops (report only)',
    '',
    `${swaps.length} stops swapped in, on ${new Set(swaps.map((line) => line.split('`')[1])).size} trips.`,
    '',
    ...swaps,
    '',
    `Trips with a lumpy step in time (more than ${LUMPY_STEP_RATIO}× the median step): ${lumpy.length}.`,
    '',
    ...lumpy,
    '',
  ]
}

const entry = (road: { ref?: string; name?: string }) => [road.ref, road.name].filter(Boolean).join(' · ')
const minutes = (seconds: number) => `${Math.round(seconds / 60)} min`
const percent = (share: number) => `${Math.round(share * 100)}%`

/** G1-G5 per known road: located or not, how many trips demand it, and how many of those some stop rides. */
function greatRoadSection(roads: RoadStatus[], trips: Map<string, BenchTrip>, results: TripResult[]): string[] {
  if (roads.length === 0) return []
  const rows = roads.map(({ road, located, unlocatable, overlay, funShare }) => {
    if (!located) return `| ${road.id} | ${entry(road)} | **unlocatable**: ${unlocatable} | | | | | | | | |`
    const pairs = results.flatMap((result) => (result.greatRoads[road.id] ? [{ result, pair: result.greatRoads[road.id] }] : []))
    const demanded = pairs.filter(({ pair }) => pair.demanded)
    const found = demanded.filter(({ pair }) => pair.foundAt !== null)
    const ridden = pairs.filter(({ pair }) => pair.foundAt !== null)
    const ratios = pairs.flatMap(({ pair }) => (pair.costRatio === null ? [] : [pair.costRatio])).sort((a, b) => a - b)
    return (
      `| ${road.id} | ${entry(road)} | ${(located.lengthM / 1000).toFixed(1)} km${located.deadEnd ? ', dead end' : ''}` +
      ` | ${percent(overlay ?? 0)} | ${percent(funShare ?? 0)} | ${pairs.length} | ${demanded.length} | ${found.length} | ${ridden.length} | ${demanded.filter(({ pair }) => pair.lastRides).length} | ` +
      `${ratios.length ? ratios[Math.floor(ratios.length / 2)].toFixed(1) : '-'} |`
    )
  })
  const missed = roads.flatMap(({ road }) =>
    results.flatMap((result) => {
      const pair = result.greatRoads[road.id]
      return pair?.demanded && pair.foundAt === null ? [`- \`${road.id}\` on \`${result.id}\` (${trips.get(result.id)?.set}): costs ${minutes(pair.costS)}, no stop rides it`] : []
    }),
  )
  const demandedOf = (set?: BenchTrip['set']) =>
    results.filter((result) => !set || trips.get(result.id)?.set === set).flatMap((result) => Object.values(result.greatRoads).filter((pair) => pair.demanded))
  const recall = (set?: BenchTrip['set']) => {
    const pairs = demandedOf(set)
    return `${pairs.filter((pair) => pair.foundAt !== null).length} of ${pairs.length}`
  }
  return [
    '## Great roads',
    '',
    `A road is demanded of a trip when it is located, not a dead end, and costs at most ${minutes(GREAT_ROAD_DEMAND_S)} over the fastest route ` +
      `(measured up to ${minutes(GREAT_ROAD_REPORT_S)}). It is found when some stop rides at least 80% of it. ` +
      `Recall on demanded pairs, holdout trips (the headline: no tuning has seen them): ${recall('holdout')}; tuning trips: ${recall('tuning')}; all: ${recall()}.`,
    '',
    '| Road | Entry | Located | On the overlay | Graph fun | Trips near | Demanded | Found | Ridden by any stop | Max-curves rides | Median cost ratio |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '### Demanded and missed',
    '',
    ...(missed.length ? missed : ['None.']),
    '',
  ]
}

function sanitySection(results: TripResult[], trips: Map<string, BenchTrip>, baseline: Map<string, TripResult> | null): string[] {
  const rows = checkRows(results, trips, baseline).map(
    (row) => `| ${row.check} | ${row.rule} | ${row.trips} | ${row.stops} | ${row.atDefaultStop} | ${baseline ? row.newTrips : '-'} | ${baseline ? row.fixedTrips : '-'} |`,
  )
  const worst = worstTrips(results, trips).map(({ id, count, checks }) => `- \`${id}\`: ${count} (${checks.join(', ')})`)
  return [
    '## Route sanity (report only)',
    '',
    'None of these fails a run yet: a check becomes a ratchet when it has caught a problem a person confirmed. Counts are trips; stops are the slider stops that break it.',
    '',
    '| Check | Rule | Trips | Stops | At the default stop | New | Fixed |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '### Trips with most violations',
    '',
    ...(worst.length ? worst : ['None.']),
    '',
  ]
}

/** G6: the overlay's well-rated roads that trips could have ridden within half an hour and no stop did. */
function modelRecallSection(results: TripResult[]): string[] {
  const byRoad = new Map<number, { label: string; rating: number; lengthM: number; trips: number; cheapestS: number }>()
  for (const result of results) {
    for (const missed of result.missedTwisties) {
      const known = byRoad.get(missed.id)
      byRoad.set(missed.id, {
        label: missed.label,
        rating: missed.rating,
        lengthM: missed.lengthM,
        trips: (known?.trips ?? 0) + 1,
        cheapestS: Math.min(known?.cheapestS ?? Infinity, missed.costS),
      })
    }
  }
  const top = [...byRoad.values()].sort((a, b) => b.trips - a.trips).slice(0, 12)
  const trips = results.filter((result) => result.missedTwisties.length > 0).length
  return [
    '## Model recall (G6, report only)',
    '',
    `Roads of the overlay rated 4 or 5 that cost at most 30 minutes of detour and that no stop rides: ${trips} of ${results.length} trips have at least one (up to five listed per trip).`,
    '',
    ...(top.length
      ? ['| Road | Rating | km | Trips that miss it | Cheapest detour |', '| --- | --- | --- | --- | --- |', ...top.map((road) => `| ${road.label} | ${road.rating} | ${(road.lengthM / 1000).toFixed(1)} | ${road.trips} | ${Math.round(road.cheapestS / 60)} min |`)]
      : ['None.']),
    '',
  ]
}
