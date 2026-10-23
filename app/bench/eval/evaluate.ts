import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Graph, parseGraph } from '../../src/lib/data/graph'
import { parseCandidates } from '../../src/lib/routing/candidates'
import { EdgeWeights } from '../../src/lib/routing/edgeWeights'
import { NodeLocator } from '../../src/lib/routing/nodeLocator'
import { Planner } from '../../src/lib/routing/planner'
import { buildRideOption, type RideOption } from '../../src/lib/routing/ride'
import { ShortestPaths } from '../../src/lib/routing/shortestPaths'
import { dataHash } from '../dataHash'
import { type LocatedRoad, locateRoad } from '../roads'
import { km, repeatedM, type RouteCard, routeCard, unsafeM } from './card'
import {
  distinctRoutes,
  type PairItem,
  type PairKey,
  type PairList,
  type SampleItem,
  type SampleKey,
  oursIsX,
  renderPairs,
  renderSample,
  ridesRoad,
  sampleStops,
  shuffled,
  stopNearestCost,
  tripFacts,
  type TripFacts,
  type VersionRoute,
} from './dossier'
import { forcedRoutes } from './forced'
import { type Added, addedPairId, type Frozen, type FrozenTrip, type Pair, pairId } from './frozen'

export interface EvalRun {
  dataDir: string
  frozen: Frozen
  /** Misses of this commit that the frozen list does not have: a second list, never a replacement. */
  added: Added
  outDir: string
  commit: string
  promptPath: string
}

/** A pair or a trip the kit could not build: it is never dropped silently. */
interface Skipped {
  id: string
  trip: string
  road: string
  because: string
}

/** Worth a look: a forced route that backtracks, a road that is itself unsafe, a stop that is the forced route. */
interface Flag {
  id: string
  trip: string
  road: string
  because: string
}

const FLAG_UNSAFE_KM = 5
const FLAG_REPEATED_KM = 1

const toArrayBuffer = (path: string): ArrayBuffer => {
  const bytes = readFileSync(path)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16)

/** What the planner and the searches work on, loaded once from the data folder. */
interface Engine {
  graph: Graph
  planner: Planner
  locator: NodeLocator
  weights: EdgeWeights
  searches: { fromStart: ShortestPaths; fromEnd: ShortestPaths }
}

function loadEngine(dataDir: string): Engine {
  const graph = parseGraph(toArrayBuffer(join(dataDir, 'graph.bin')))
  const candidatesFile = join(dataDir, 'candidates.bin')
  const file = existsSync(candidatesFile) ? parseCandidates(graph, toArrayBuffer(candidatesFile)) : undefined
  return {
    graph,
    planner: new Planner(graph, file?.candidates, file?.legs),
    locator: new NodeLocator(graph),
    weights: new EdgeWeights(graph),
    searches: { fromStart: new ShortestPaths(graph), fromEnd: new ShortestPaths(graph, 'backward') },
  }
}

/** One planned trip: its stops and the figures every item of the trip shows. */
interface PlannedTrip {
  trip: FrozenTrip
  options: RideOption[]
  start: number
  end: number
  facts: TripFacts
}

interface Findings {
  pairs: { item: PairItem; key: PairKey }[]
  sample: { item: SampleItem; key: SampleKey }[]
  skipped: Skipped[]
  flags: Flag[]
}

/** Plans the frozen trips on the data folder and writes the blind dossier and its key. */
export function evaluate({ dataDir, frozen, added, outDir, commit, promptPath }: EvalRun): number {
  const engine = loadEngine(dataDir)
  const trips = new Map<string, FrozenTrip>([...frozen.trips, ...added.trips].map((trip) => [trip.id, trip]))
  const located = new Map<string, LocatedRoad | string>()
  for (const road of [...frozen.roads, ...added.roads]) {
    const location = locateRoad(engine.graph, road)
    located.set(road.id, 'located' in location ? location.located : location.unlocatable)
  }
  const lists: { list: PairList; pair: Pair }[] = [
    ...frozen.misses.map((pair) => ({ list: 'miss' as const, pair })),
    ...frozen.controls.map((pair) => ({ list: 'control' as const, pair })),
    ...added.pairs.map((pair) => ({ list: 'added' as const, pair })),
  ]
  const tripIds = [...new Set([...lists.map(({ pair }) => pair.trip), ...frozen.sample])].sort()

  const found: Findings = { pairs: [], sample: [], skipped: [], flags: [] }
  const started = performance.now()
  for (const tripId of tripIds) {
    const trip = trips.get(tripId) as FrozenTrip
    const mine = lists.filter(({ pair }) => pair.trip === tripId)
    const planned = planTrip(engine, trip)
    if (typeof planned === 'string') {
      for (const { list, pair } of mine) found.skipped.push({ id: idOf(list, pair, frozen.seed), trip: tripId, road: pair.road, because: planned })
      if (frozen.sample.includes(tripId)) found.skipped.push({ id: tripId, trip: tripId, road: '', because: planned })
      continue
    }
    const roads = mine.flatMap(({ pair }) => {
      const road = located.get(pair.road)
      return typeof road === 'object' ? [road] : []
    })
    const forced = forcedRoutes(engine.searches, engine.weights, { start: planned.start, end: planned.end, includeTracks: false }, roads)
    for (const { list, pair } of mine) {
      const id = idOf(list, pair, frozen.seed)
      const road = located.get(pair.road) as LocatedRoad | string
      const route = typeof road === 'object' ? forced.get(pair.road) : null
      if (typeof road === 'string') found.skipped.push({ id, trip: tripId, road: pair.road, because: `the road is not in the graph: ${road}` })
      else if (!route) found.skipped.push({ id, trip: tripId, road: pair.road, because: 'the road cannot be reached from the trip' })
      else {
        const entry = pairEntry(engine.graph, planned, { id, list, pair, road, edges: route.edges }, frozen.seed)
        found.pairs.push(entry)
        found.flags.push(...flagsOf(entry))
      }
    }
    if (frozen.sample.includes(tripId)) found.sample.push(...sampleEntries(engine.graph, planned, frozen.seed))
    console.log(`${tripId}: ${planned.options.length} stops, ${mine.length} pairs (${((performance.now() - started) / 1000).toFixed(0)} s)`)
  }
  return writeDossier({ dataDir, frozen, outDir, commit, promptPath }, found)
}

const idOf = (list: PairList, pair: Pair, seed: number): string => (list === 'added' ? addedPairId(pair, seed) : pairId(pair, seed))

function planTrip(engine: Engine, trip: FrozenTrip): PlannedTrip | string {
  try {
    const options = engine.planner.plan([trip.from, trip.to], { includeTracks: false })
    return { trip, options, start: engine.locator.nearest(trip.from), end: engine.locator.nearest(trip.to), facts: tripFacts(trip, options[0]) }
  } catch (error) {
    return `the trip did not plan: ${error instanceof Error ? error.message : error}`
  }
}

interface PairInput {
  id: string
  list: PairList
  pair: Pair
  road: LocatedRoad
  /** The forced route's edges, from the trip's start. */
  edges: number[]
}

/** Our stop and the forced route for a pair; for a control our stop is the first one that rides the road. */
function pairEntry(graph: Graph, planned: PlannedTrip, { id, list, pair, road, edges }: PairInput, seed: number): { item: PairItem; key: PairKey } {
  const { trip, options, start, facts } = planned
  const forced = buildRideOption({ graph, points: [trip.from, trip.to], start, edges, fastestS: options[0].timeS })
  const riding = list === 'control' ? options.findIndex((option) => ridesRoad(option, road)) : -1
  const stop = riding >= 0 ? riding : stopNearestCost(options, forced.extraS)
  const [oursCard, forcedCard] = [routeCard(graph, options[stop]), routeCard(graph, forced)]
  const oursFirst = oursIsX(id, seed)
  return {
    item: { id, trip: facts, x: oursFirst ? oursCard : forcedCard, y: oursFirst ? forcedCard : oursCard },
    key: {
      id,
      list,
      trip: pair.trip,
      road: pair.road,
      forcedCostMin: forcedCard.extraMin,
      x: oursFirst ? 'ours' : 'forced',
      stop,
      stopExtraMin: oursCard.extraMin,
      ours: { rides: ridesRoad(options[stop], road) },
      roadKm: km(road.lengthM),
      roadUnsafeKm: km(unsafeM(graph, road.edges)),
      forcedRepeatedKm: km(repeatedM(graph, edges)),
    },
  }
}

/** The default stop and the stop with the most fun: one route when they are the same. */
function sampleEntries(graph: Graph, planned: PlannedTrip, seed: number): { item: SampleItem; key: SampleKey }[] {
  const { trip, options, facts } = planned
  return sampleStopsOf(options).map(({ stop, slots }) => {
    const id = `s-${sha(`${seed}:${trip.id}:${slots[0]}`).slice(0, 8)}`
    return { item: { id, trip: facts, route: routeCard(graph, options[stop]) }, key: { id, trip: trip.id, slots, stop } }
  })
}

const sideOf = (entry: { item: PairItem; key: PairKey }, side: 'ours' | 'forced'): RouteCard => (entry.key.x === side ? entry.item.x : entry.item.y)

function flagsOf(entry: { item: PairItem; key: PairKey }): Flag[] {
  const { key } = entry
  const because: string[] = []
  if (key.forcedRepeatedKm >= FLAG_REPEATED_KM) because.push(`the forced route walks ${key.forcedRepeatedKm} km twice`)
  if (key.roadUnsafeKm >= FLAG_UNSAFE_KM) because.push(`the road itself carries ${key.roadUnsafeKm} unsafe km of ${key.roadKm}`)
  if (JSON.stringify(sideOf(entry, 'ours').roads) === JSON.stringify(sideOf(entry, 'forced').roads)) because.push('our stop and the forced route are the same route')
  return because.map((reason) => ({ id: key.id, trip: key.trip, road: key.road, because: reason }))
}

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0

const json = (value: unknown) => `${JSON.stringify(value, null, 1)}\n`
const preface = (task: string, note = '') => `# ${task}\n\nRead \`judge-prompt.md\` first: it says what to judge and what every figure means.${note}\n`
const ABSOLUTE_TASK = 'Absolute: would you ride this, for this trip?'

/** Opens a dossier folder with the judge's prompt in it; returns the prompt and a writer for the folder's files. */
function openDossier(outDir: string, promptPath: string): { prompt: string; write: (name: string, content: string) => void } {
  mkdirSync(outDir, { recursive: true })
  const write = (name: string, content: string) => writeFileSync(join(outDir, name), content)
  const prompt = readFileSync(promptPath, 'utf8')
  write('judge-prompt.md', prompt)
  return { prompt, write }
}

function writeDossier({ dataDir, frozen, outDir, commit, promptPath }: Pick<EvalRun, 'dataDir' | 'frozen' | 'outDir' | 'commit' | 'promptPath'>, found: Findings): number {
  const { prompt, write } = openDossier(outDir, promptPath)
  const pairs = shuffled(found.pairs.map(({ item }) => item), frozen.seed)
  const sample = shuffled(found.sample.map(({ item }) => item), frozen.seed)
  write('pairs.md', renderPairs(pairs, preface('Pairs: which route would you ride?')))
  write('absolute.md', renderSample(sample, preface(ABSOLUTE_TASK)))
  write('pairs.json', json(pairs))
  write('absolute.json', json(sample))
  const header = { commit, data: dataHash(dataDir), seed: frozen.seed, frozenFrom: frozen.from, prompt: sha(prompt) }
  const keys = found.pairs.map(({ key }) => key)
  write('key.json', json({ ...header, pairs: keys, sample: found.sample.map(({ key }) => key) }))
  const counts = {
    misses: keys.filter((key) => key.list === 'miss').length,
    controls: keys.filter((key) => key.list === 'control').length,
    added: keys.filter((key) => key.list === 'added').length,
    sampleTrips: new Set(found.sample.map(({ key }) => key.trip)).size,
    sampleRoutes: found.sample.length,
    forcedHasLessFunThanOurs: found.pairs.filter((entry) => sideOf(entry, 'forced').funKm < sideOf(entry, 'ours').funKm).length,
    medianMinutesBetweenOursAndForced: median(found.pairs.map(({ key }) => Math.abs(key.stopExtraMin - key.forcedCostMin))),
  }
  write('summary.json', json({ ...header, counts, skipped: found.skipped, flags: found.flags }))
  console.log(`${JSON.stringify(counts)}; ${found.skipped.length} skipped, ${found.flags.length} flags: ${outDir}`)
  return found.skipped.length > 0 ? 1 : 0
}

const sameEnds = (a: Uint32Array, b: Uint32Array): boolean => a.length === b.length && a.every((node, index) => node === b[index])

/** Whether two graphs hold the same nodes and edges between them, so an edge id means the same stretch in both. */
const sameRoads = (a: Graph, b: Graph): boolean =>
  a.nodeCount === b.nodeCount && a.edgeCount === b.edgeCount && sameEnds(a.edgeFrom, b.edgeFrom) && sameEnds(a.edgeTo, b.edgeTo)

export interface TripsRun {
  /** The versions to judge side by side; the first is the reference whose graph every card is computed on. */
  dataDirs: string[]
  trips: FrozenTrip[]
  seed: number
  outDir: string
  commit: string
  promptPath: string
}

/** One judged route of the out-of-sample dossier: which versions, slots and stops it stands for. */
export interface TripsKey {
  id: string
  trip: string
  versions: Omit<VersionRoute, 'edges'>[]
}

/**
 * Absolute cards only, for trips outside the frozen lists: each trip planned on every data folder, its default and
 * most-fun stops mixed blind in one dossier. The cards are all computed on the reference graph, so a version's figures
 * differ only where its route does; the folders must share the graph's shape (a change of value, not of roads).
 */
export function evaluateTrips({ dataDirs, trips, seed, outDir, commit, promptPath }: TripsRun): number {
  const engines = dataDirs.map(loadEngine)
  const reference = engines[0].graph
  for (const [index, { graph }] of engines.entries()) {
    if (!sameRoads(graph, reference)) {
      throw new Error(`${dataDirs[index]} has another graph shape than ${dataDirs[0]}: its routes cannot be drawn on the reference`)
    }
  }
  const items: SampleItem[] = []
  const keys: TripsKey[] = []
  const skipped: Skipped[] = []
  for (const trip of trips) {
    const planned = engines.map((engine) => planTrip(engine, trip))
    const failed = planned.find((plan): plan is string => typeof plan === 'string')
    if (failed) {
      skipped.push({ id: trip.id, trip: trip.id, road: '', because: failed })
      continue
    }
    const plans = planned as PlannedTrip[]
    const routes = plans.flatMap(({ options }, version) => sampleStopsOf(options).map(({ stop, slots }) => ({ version, slots, stop, edges: options[stop].edges })))
    const { start, facts, options } = plans[0]
    for (const { edges, versions } of distinctRoutes(routes)) {
      const option = buildRideOption({ graph: reference, points: [trip.from, trip.to], start, edges, fastestS: options[0].timeS })
      const route = routeCard(reference, option)
      const id = `o-${sha(`${seed}:${trip.id}:${edges.join(',')}`).slice(0, 8)}`
      items.push({ id, trip: facts, route })
      keys.push({ id, trip: trip.id, versions })
    }
  }
  const { prompt, write } = openDossier(outDir, promptPath)
  const sample = shuffled(items, seed)
  write('absolute.md', renderSample(sample, preface(ABSOLUTE_TASK, ' This dossier has absolute items only.')))
  write('absolute.json', json(sample))
  const header = { commit, data: dataDirs.map(dataHash), seed, prompt: sha(prompt) }
  write('key.json', json({ ...header, sample: keys }))
  write('summary.json', json({ ...header, counts: { trips: trips.length - skipped.length, routes: items.length }, skipped }))
  console.log(`${items.length} routes of ${trips.length - skipped.length} trips on ${dataDirs.length} data folders; ${skipped.length} skipped: ${outDir}`)
  return skipped.length > 0 ? 1 : 0
}

/** The default and the most-fun stop, as one route when they are the same stop. */
function sampleStopsOf(options: RideOption[]): { stop: number; slots: ('default' | 'fun')[] }[] {
  const stops = sampleStops(options)
  return stops.default === stops.fun ? [{ stop: stops.default, slots: ['default', 'fun'] }] : [{ stop: stops.default, slots: ['default'] }, { stop: stops.fun, slots: ['fun'] }]
}
