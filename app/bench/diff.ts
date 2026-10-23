import type { Baseline, BaselineHeader } from './baseline'
import type { GreatRoadResult } from './greatRoads'
import type { OptionRecord, TripResult } from './results'
import type { BenchTrip } from './trips'

/** Extra minutes over the fastest route at which the best option is compared. */
export const BUDGET_POINTS_MIN = [0, 15, 30, 45, 60, 90, 120, 180]
/** A budget point gained or lost something when it moved by at least this much or this share, whichever is more. */
const MIN_CHANGE_M = 1_000
const MIN_CHANGE_SHARE = 0.05
const ROAD_CHANGES_LISTED = 12

export type Verdict = 'improved' | 'worsened' | 'mixed' | 'unchanged'
export type SetName = 'tuning' | 'holdout'

/** The best value of `metric` among the options within each budget, so it does not depend on how many stops there are. */
export function budgetCurve(options: OptionRecord[], metric: (option: OptionRecord) => number): number[] {
  return BUDGET_POINTS_MIN.map((minutes) =>
    options.filter((option) => option.extraS <= minutes * 60).reduce((best, option) => Math.max(best, metric(option)), 0),
  )
}

export function verdict(before: number[], after: number[]): Verdict {
  const moved = before.map((was, i) => after[i] - was)
  const significant = (change: number, was: number) => Math.abs(change) >= Math.max(MIN_CHANGE_M, MIN_CHANGE_SHARE * was)
  const gained = moved.some((change, i) => change > 0 && significant(change, before[i]))
  const lost = moved.some((change, i) => change < 0 && significant(change, before[i]))
  if (gained && lost) return 'mixed'
  return gained ? 'improved' : lost ? 'worsened' : 'unchanged'
}

/** Two-sided exact sign test: how likely a split at least this uneven is when changes are as likely to help as to hurt. */
export function signTestP(improved: number, worsened: number): number {
  const n = improved + worsened
  if (n === 0) return 1
  const tail = Math.max(improved, worsened)
  let probability = 0
  let choose = 1
  for (let k = 0; k <= n; k++) {
    if (k > 0) choose = (choose * (n - k + 1)) / k
    if (k >= tail) probability += choose / 2 ** n
  }
  return Math.min(1, 2 * probability)
}

export interface Tally {
  improved: string[]
  worsened: string[]
  mixed: string[]
  unchanged: number
  pValue: number
}

export interface RoadChange {
  label: string
  tripsGained: number
  tripsLost: number
  kmGained: number
  kmLost: number
}

export interface PairChange {
  road: string
  trip: string
}

export interface RunData {
  header: BaselineHeader
  results: TripResult[]
}

export interface Diff {
  /** Same data build: route ids and the fun score compare. */
  sameData: boolean
  identical: string[]
  /** Same routes, shown differently. */
  presentationOnly: string[]
  changed: string[]
  newTrips: string[]
  removedTrips: string[]
  twistyKm: Record<SetName, Tally>
  /** Not judged when the data changed: the fun yardstick moved with it. */
  curvy: Record<SetName, Tally> | null
  roads: RoadChange[]
  greatRoads: {
    lost: PairChange[]
    gained: PairChange[]
    unlocatable: string[]
    /** Ids of the baseline's list that the list no longer has (renamed or dropped): their pairs are not compared. */
    removed: string[]
    recall: Record<SetName, { before: [found: number, demanded: number]; now: [found: number, demanded: number] }>
  }
  cost: { before: CostStats; now: CostStats }
  failures: string[]
}

export interface CostStats {
  settledMean: number
  settledP95: number
  msMedian: number
  msP95: number
}

export function compare(baseline: Baseline, now: RunData, trips: BenchTrip[], expectIdentical: boolean): Diff {
  const sets = new Map(trips.map((trip) => [trip.id, trip.set]))
  const nowById = new Map(now.results.map((result) => [result.id, result]))
  const common = now.results.filter((result) => baseline.results.has(result.id))
  const sameData = baseline.header.dataHash === now.header.dataHash

  const identical: string[] = []
  const presentationOnly: string[] = []
  const changed: string[] = []
  for (const result of common) {
    const before = baseline.results.get(result.id) as TripResult
    const sameRoutes = before.options.length === result.options.length && before.options.every((option, i) => option.routeId === result.options[i].routeId)
    const sameLook = sameRoutes && before.options.every((option, i) => option.presentation === result.options[i].presentation)
    if (sameRoutes && sameLook) identical.push(result.id)
    else if (sameRoutes) presentationOnly.push(result.id)
    else changed.push(result.id)
  }

  const tally = (metric: (option: OptionRecord) => number): Record<SetName, Tally> => {
    const bySet = (set: SetName): Tally => {
      const verdicts = common
        .filter((result) => sets.get(result.id) === set)
        .map((result) => ({ id: result.id, verdict: verdict(budgetCurve((baseline.results.get(result.id) as TripResult).options, metric), budgetCurve(result.options, metric)) }))
      const ids = (wanted: Verdict) => verdicts.filter((entry) => entry.verdict === wanted).map((entry) => entry.id)
      return {
        improved: ids('improved'),
        worsened: ids('worsened'),
        mixed: ids('mixed'),
        unchanged: ids('unchanged').length,
        pValue: signTestP(ids('improved').length, ids('worsened').length),
      }
    }
    return { tuning: bySet('tuning'), holdout: bySet('holdout') }
  }

  const greatRoads = compareGreatRoads(baseline, now, common, sets)
  const failures: string[] = []
  if (expectIdentical) {
    if (!sameData) failures.push('--expect identical: the data is not the baseline\'s (data hash differs)')
    failures.push(...changed.map((id) => `--expect identical: ${id} has different routes`))
  }
  failures.push(...greatRoads.lost.map(({ road, trip }) => `G1 loss: ${road} was found on ${trip} and is not any more`))
  failures.push(...greatRoads.unlocatable.map((road) => `G2 unlocatable: ${road} was located in the baseline and is not any more`))

  return {
    sameData,
    identical,
    presentationOnly,
    changed,
    newTrips: now.results.filter((result) => !baseline.results.has(result.id)).map((result) => result.id),
    removedTrips: [...baseline.results.keys()].filter((id) => !nowById.has(id)),
    twistyKm: tally((option) => option.benchTwistyM),
    curvy: sameData ? tally((option) => option.curvyM) : null,
    roads: roadChanges(baseline, common),
    greatRoads,
    cost: { before: costStats([...baseline.results.values()].filter((result) => nowById.has(result.id))), now: costStats(common) },
    failures,
  }
}

function compareGreatRoads(baseline: Baseline, now: RunData, common: TripResult[], sets: Map<string, SetName>): Diff['greatRoads'] {
  const lost: PairChange[] = []
  const gained: PairChange[] = []
  const recall = { tuning: { before: [0, 0], now: [0, 0] }, holdout: { before: [0, 0], now: [0, 0] } } as Diff['greatRoads']['recall']
  const count = (side: [number, number], pair: GreatRoadResult) => {
    if (!pair.demanded) return
    side[1]++
    if (pair.foundAt !== null) side[0]++
  }
  for (const result of common) {
    const before = (baseline.results.get(result.id) as TripResult).greatRoads
    const set = sets.get(result.id) ?? 'tuning'
    for (const [road, pair] of Object.entries(result.greatRoads)) {
      const was = before[road]
      count(recall[set].now, pair)
      if (!was) continue
      count(recall[set].before, was)
      if (!was.demanded || !pair.demanded) continue
      if (was.foundAt !== null && pair.foundAt === null) lost.push({ road, trip: result.id })
      if (was.foundAt === null && pair.foundAt !== null) gained.push({ road, trip: result.id })
    }
  }
  const unlocatable = Object.entries(baseline.header.roads)
    .filter(([id, was]) => was.located && now.header.roads[id] && !now.header.roads[id].located)
    .map(([id]) => id)
  const removed = Object.keys(baseline.header.roads).filter((id) => !(id in now.header.roads))
  return { lost, gained, unlocatable, removed, recall }
}

function roadChanges(baseline: Baseline, common: TripResult[]): RoadChange[] {
  const changes = new Map<string, RoadChange>()
  const change = (label: string) => {
    const entry = changes.get(label) ?? { label, tripsGained: 0, tripsLost: 0, kmGained: 0, kmLost: 0 }
    changes.set(label, entry)
    return entry
  }
  const longest = (result: TripResult) => {
    const lengths = new Map<string, number>()
    for (const option of result.options) {
      for (const [label, lengthM] of option.twisties) lengths.set(label || '(unnamed)', Math.max(lengths.get(label || '(unnamed)') ?? 0, lengthM))
    }
    return lengths
  }
  for (const result of common) {
    const [was, is] = [longest(baseline.results.get(result.id) as TripResult), longest(result)]
    for (const [label, lengthM] of is) {
      if (was.has(label)) continue
      change(label).tripsGained++
      change(label).kmGained += lengthM / 1000
    }
    for (const [label, lengthM] of was) {
      if (is.has(label)) continue
      change(label).tripsLost++
      change(label).kmLost += lengthM / 1000
    }
  }
  return [...changes.values()].sort((a, b) => b.tripsGained + b.tripsLost - (a.tripsGained + a.tripsLost))
}

function costStats(results: TripResult[]): CostStats {
  const sorted = (values: number[]) => [...values].sort((a, b) => a - b)
  const at = (values: number[], share: number) => sorted(values)[Math.min(values.length - 1, Math.floor(share * values.length))] ?? 0
  const settled = results.map((result) => result.settled)
  const ms = results.map((result) => result.ms)
  return { settledMean: settled.reduce((a, b) => a + b, 0) / Math.max(1, settled.length), settledP95: at(settled, 0.95), msMedian: at(ms, 0.5), msP95: at(ms, 0.95) }
}

const thousands = (value: number) => `${Math.round(value / 1000).toLocaleString('en')}k`

export function renderDiff(diff: Diff, baselineHeader: BaselineHeader): string[] {
  const tallyLine = (name: string, tally: Tally) =>
    `${name}: ${tally.improved.length} improved, ${tally.worsened.length} worsened, ${tally.mixed.length} mixed, ${tally.unchanged} unchanged (sign test p = ${tally.pValue.toFixed(3)})`
  const recall = (side: [number, number]) => `${side[0]} of ${side[1]}`
  const roads = diff.roads.slice(0, ROAD_CHANGES_LISTED)
  return [
    `## Against the baseline (${baselineHeader.commit}, ${baselineHeader.createdAt.slice(0, 10)})`,
    '',
    diff.sameData ? 'Same data build.' : '**Different data build**: route ids and fun scores are not comparable; only twisty km are judged.',
    '',
    '### D1 Identical',
    '',
    `${diff.identical.length} trips identical, ${diff.presentationOnly.length} with the same routes shown differently, ${diff.changed.length} with different routes` +
      `${diff.newTrips.length ? `, ${diff.newTrips.length} new` : ''}${diff.removedTrips.length ? `, ${diff.removedTrips.length} no longer run` : ''}.`,
    ...(diff.presentationOnly.length ? ['', `Same routes, shown differently: ${diff.presentationOnly.map((id) => `\`${id}\``).join(', ')}`] : []),
    '',
    '### D2 Better and worse',
    '',
    'Per trip, the best twisty km (and fun) within each extra-time budget, before and after.',
    '',
    `- ${tallyLine('Twisty km, tuning', diff.twistyKm.tuning)}`,
    `- ${tallyLine('Twisty km, holdout', diff.twistyKm.holdout)}`,
    ...(diff.curvy ? [`- ${tallyLine('Fun, tuning', diff.curvy.tuning)}`, `- ${tallyLine('Fun, holdout', diff.curvy.holdout)}`] : []),
    ...worstLines(diff),
    '',
    '### D3 Roads gained and lost',
    '',
    ...(roads.length === 0 ? ['None.'] : ['| Road | Trips gained | Trips lost | km gained | km lost |', '| --- | --- | --- | --- | --- |', ...roads.map((road) => `| ${road.label} | ${road.tripsGained} | ${road.tripsLost} | ${road.kmGained.toFixed(0)} | ${road.kmLost.toFixed(0)} |`)]),
    '',
    '### D4 Great roads',
    '',
    `Recall on demanded pairs, tuning: ${recall(diff.greatRoads.recall.tuning.before)} → ${recall(diff.greatRoads.recall.tuning.now)}; holdout: ${recall(diff.greatRoads.recall.holdout.before)} → ${recall(diff.greatRoads.recall.holdout.now)}.`,
    `Newly found: ${diff.greatRoads.gained.length ? diff.greatRoads.gained.map(({ road, trip }) => `\`${road}\` on \`${trip}\``).join(', ') : 'none'}.`,
    `Lost: ${diff.greatRoads.lost.length ? diff.greatRoads.lost.map(({ road, trip }) => `**\`${road}\` on \`${trip}\`**`).join(', ') : 'none'}.`,
    ...(diff.greatRoads.removed.length ? [`No longer in the list (renamed or dropped, so not compared): ${diff.greatRoads.removed.map((id) => `\`${id}\``).join(', ')}.`] : []),
    '',
    '### D6 Cost',
    '',
    `Settled nodes per plan: mean ${thousands(diff.cost.before.settledMean)} → ${thousands(diff.cost.now.settledMean)}, p95 ${thousands(diff.cost.before.settledP95)} → ${thousands(diff.cost.now.settledP95)}. ` +
      `Mac milliseconds: median ${Math.round(diff.cost.before.msMedian)} → ${Math.round(diff.cost.now.msMedian)}, p95 ${Math.round(diff.cost.before.msP95)} → ${Math.round(diff.cost.now.msP95)}.`,
    '',
  ]
}

function worstLines(diff: Diff): string[] {
  const worsened = [...diff.twistyKm.tuning.worsened, ...diff.twistyKm.holdout.worsened, ...diff.twistyKm.tuning.mixed, ...diff.twistyKm.holdout.mixed]
  return worsened.length ? ['', `Trips that lost twisty km at some budget: ${worsened.map((id) => `\`${id}\``).join(', ')}.`] : []
}
