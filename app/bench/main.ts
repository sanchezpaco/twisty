import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { parseGraph } from '../src/lib/data/graph'
import type { LonLat } from '../src/lib/geo'
import type { KnownRoadContext } from './greatRoads'
import { MODEL_RECALL_MIN_RATING } from './modelRecall'
import { coveredShare, funShare, type LocatedRoad, locateRoad, PolylineIndex, readRoads, type RoadStatus } from './roads'
import { parseTwisties, type Twisty } from '../src/lib/data/twisties'
import { type BaselineHeader, readBaseline, writeBaseline } from './baseline'
import { dataHash } from './dataHash'
import type { City } from './defects'
import { compare, renderDiff } from './diff'
import { evalDossier, evalFreeze } from './eval/command'
import { generate } from './generate'
import { renderReport, summarise } from './report'
import type { TripResult } from './results'
import { twistiesFile } from './twistiesFile'
import { type BenchTrip, readTrips } from './trips'
import { viaReport } from './via'
import type { FromWorker, ToWorker, WorkerSetup } from './worker'

/** What the workers need besides the graph: the known roads, the places and the overlay's best twisties. */
export interface ReferenceData {
  context: KnownRoadContext
  statuses: RoadStatus[]
  bad: LocatedRoad[]
  places: LonLat[]
  cities: City[]
  twisties: Twisty[]
}

const PLACE_KINDS = new Set(['city', 'town', 'village'])

export function loadReferenceData(dataDir: string): ReferenceData {
  const bytes = readFileSync(join(dataDir, 'graph.bin'))
  const graph = parseGraph(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  const list = readRoads(resolve('bench/great-roads.json'))
  const twisties = parseTwisties(JSON.parse(readFileSync(twistiesFile(), 'utf8')))
  const overlay = new PolylineIndex(twisties.map((twisty) => twisty.line))
  const statuses = list.roads.map((road): RoadStatus => {
    const location = locateRoad(graph, road)
    if ('unlocatable' in location) return { road, located: null, unlocatable: location.unlocatable, overlay: null, funShare: null }
    return { road, located: location.located, unlocatable: null, overlay: coveredShare(overlay, location.located.line), funShare: funShare(graph, location.located) }
  })
  const located = statuses.flatMap(({ road, located }) => (located ? [{ road, located }] : []))
  const bad = readRoads(resolve('bench/bad-roads.json')).roads.map((road) => {
    const location = locateRoad(graph, road)
    if ('unlocatable' in location) throw new Error(`The bad road ${road.id} is not in the graph: ${location.unlocatable}`)
    return location.located
  })
  const allPlaces = (JSON.parse(readFileSync(join(dataDir, 'places.json'), 'utf8')).places as [string, string, number, number][]).filter((place) => PLACE_KINDS.has(place[1]))
  const places = allPlaces.map((place): LonLat => [place[2], place[3]])
  const cities = allPlaces.filter((place) => place[1] === 'city').map((place): City => ({ name: place[0], point: [place[2], place[3]] }))
  return {
    context: { roads: located, tunedThrough: list.tunedThrough },
    statuses,
    bad,
    places,
    cities,
    twisties: twisties.filter((twisty) => twisty.rating >= MODEL_RECALL_MIN_RATING),
  }
}

/** `roads`: where each known road is in the graph, to write and check `great-roads.json` entries. */
export function listRoads(): number {
  const { statuses } = loadReferenceData(resolve(process.env.TWISTY_DATA ?? 'public/data'))
  for (const { road, located, unlocatable, overlay, funShare } of statuses) {
    if (!located) console.log(`${road.id}: UNLOCATABLE, ${unlocatable}`)
    else {
      const { lengthM, timeS, edges, deadEnd } = located
      console.log(
        `${road.id}: ${(lengthM / 1000).toFixed(1)} km, ${(timeS / 60).toFixed(0)} min, ${edges.length} edges, ${Math.round((overlay ?? 0) * 100)}% on the overlay, ${Math.round((funShare ?? 0) * 100)}% fun in the graph${deadEnd ? ', DEAD END' : ''}`,
      )
    }
  }
  return statuses.some(({ located }) => !located) ? 1 : 0
}

interface Args {
  command: 'run' | 'baseline'
  set: 'tuning' | 'holdout' | 'all'
  only: string[] | null
  out: string | null
  expectIdentical: boolean
}

const DEFAULT_WORKERS = 3

function parseArgs(argv: string[]): Args {
  const [command, ...flags] = argv
  if (command !== 'run' && command !== 'baseline') {
    throw new Error('Usage: run.js run|baseline|roads|generate|eval-freeze|eval|via [--set tuning|holdout|all] [--only id,id] [--out dir] [--expect identical]')
  }
  const value = (flag: string) => flags[flags.indexOf(flag) + 1]
  const set = flags.includes('--set') ? value('--set') : 'all'
  if (set !== 'tuning' && set !== 'holdout' && set !== 'all') throw new Error(`Unknown set ${set}`)
  if (flags.includes('--expect') && value('--expect') !== 'identical') throw new Error(`Unknown --expect ${value('--expect')}`)
  return {
    command,
    set,
    only: flags.includes('--only') ? value('--only').split(',') : null,
    out: flags.includes('--out') ? value('--out') : null,
    expectIdentical: flags.includes('--expect'),
  }
}

function gitLabel(): string {
  const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  return execSync('git status --porcelain', { encoding: 'utf8' }).trim() ? `${sha}-dirty` : sha
}

/** Hands out trips to the workers: the one that holds the stacked graph takes the trips with tracks. */
class Queue {
  private readonly withTracks: BenchTrip[]
  private readonly roadsOnly: BenchTrip[]

  constructor(trips: BenchTrip[]) {
    this.withTracks = trips.filter((trip) => trip.includeTracks)
    this.roadsOnly = trips.filter((trip) => !trip.includeTracks)
  }

  next(worker: number): BenchTrip | undefined {
    return worker === 0 ? (this.withTracks.shift() ?? this.roadsOnly.shift()) : this.roadsOnly.shift()
  }
}

const BASELINE_PATH = 'bench/baseline.jsonl'

const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16)

function runHeader(dataDir: string, statuses: RoadStatus[], accepted: BaselineHeader['accepted']): BaselineHeader {
  const { source, nodes, edges } = JSON.parse(readFileSync(join(dataDir, 'meta.json'), 'utf8'))
  return {
    commit: gitLabel(),
    dataHash: dataHash(dataDir),
    data: { source, nodes, edges },
    tripsHash: fileHash(resolve('bench/trips.json')),
    roadsHash: fileHash(resolve('bench/great-roads.json')),
    createdAt: new Date().toISOString(),
    roads: Object.fromEntries(statuses.map(({ road, located }) => [road.id, { located: located !== null, deadEnd: located?.deadEnd ?? false }])),
    accepted,
  }
}

export async function main(argv: string[]): Promise<number> {
  if (argv[0] === 'roads') return listRoads()
  if (argv[0] === 'generate') {
    const dataDir = resolve(process.env.TWISTY_DATA ?? 'public/data')
    return generate(dataDir, loadReferenceData(dataDir).context)
  }
  if (argv[0] === 'eval-freeze') return evalFreeze(argv.slice(1))
  if (argv[0] === 'eval') return evalDossier(argv.slice(1), gitLabel())
  if (argv[0] === 'via') return viaReport(resolve(process.env.TWISTY_DATA ?? 'public/data'), resolve('bench/via-trips.json'), resolve(argv[1] === '--out' ? argv[2] : join('bench/out', gitLabel())))
  const args = parseArgs(argv)
  const partial = args.set !== 'all' || args.only !== null
  if (args.command === 'baseline' && partial) throw new Error('A baseline holds every trip: run it without --set or --only')
  const baseline = readBaseline(BASELINE_PATH)
  if (args.expectIdentical && !baseline) throw new Error(`--expect identical needs ${BASELINE_PATH}`)
  const dataDir = resolve(process.env.TWISTY_DATA ?? 'public/data')
  const allTrips = readTrips(resolve('bench/trips.json'))
  const trips = allTrips.filter((trip) => (args.set === 'all' || trip.set === args.set) && (!args.only || args.only.includes(trip.id)))
  if (trips.length === 0) throw new Error('No trips to plan')
  const workerCount = Math.min(trips.length, Number(process.env.BENCH_WORKERS ?? process.env.VITEST_MAX_WORKERS ?? DEFAULT_WORKERS))
  const out = resolve(args.out ?? join('bench/out', gitLabel()))
  const started = performance.now()

  const { context, statuses, bad, places, cities, twisties } = loadReferenceData(dataDir)
  const queue = new Queue(trips)
  const results: TripResult[] = []
  const runFailures: string[] = []
  await Promise.all(
    Array.from({ length: workerCount }, (_, index) => runWorker(index, { dataDir, roads: context, bad, places, cities, twisties }, queue, results, runFailures)),
  )

  results.sort((a, b) => a.id.localeCompare(b.id))
  const header = runHeader(dataDir, statuses, baseline?.header.accepted ?? [])
  const summary = summarise({ label: header.commit, dataHash: header.dataHash, workers: workerCount, wallS: (performance.now() - started) / 1000 }, results)
  const diff = baseline ? compare(baseline, { header, results }, allTrips, args.expectIdentical) : null
  runFailures.push(...(diff?.failures ?? []))

  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'results.jsonl'), `${results.map((result) => JSON.stringify({ ...result, dataHash: header.dataHash })).join('\n')}\n`)
  writeFileSync(join(out, 'summary.json'), `${JSON.stringify({ ...summary, diff }, null, 2)}\n`)
  writeFileSync(join(out, 'report.md'), renderReport(summary, trips, results, runFailures, statuses, diff && baseline ? renderDiff(diff, baseline.header) : [], baseline?.results ?? null))
  if (args.command === 'baseline') writeBaseline(BASELINE_PATH, header, results)
  const failures = summary.failures + runFailures.length
  console.log(`${summary.trips} trips in ${summary.wallS.toFixed(0)} s, ${failures} failures: ${join(out, 'report.md')}${args.command === 'baseline' ? `; wrote ${BASELINE_PATH}` : ''}`)
  return failures > 0 ? 1 : 0
}

function runWorker(index: number, setup: WorkerSetup, queue: Queue, results: TripResult[], runFailures: string[]): Promise<void> {
  const worker = new Worker(fileURLToPath(import.meta.url), { workerData: setup })
  const send = (message: ToWorker) => worker.postMessage(message)
  const assign = () => {
    const trip = queue.next(index)
    send(trip ? { type: 'trip', trip } : { type: 'finish' })
  }
  return new Promise((done, fail) => {
    worker.on('error', fail)
    worker.on('message', (message: FromWorker) => {
      if (message.type === 'ready') assign()
      else if (message.type === 'result') {
        results.push(message.result)
        assign()
      } else {
        if (!message.deterministic) runFailures.push(`H10 deterministic: worker ${index} planned ${message.checked} differently the second time`)
        void worker.terminate().then(() => done())
      }
    })
  })
}
