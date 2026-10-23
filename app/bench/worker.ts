import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'
import { type Graph, parseGraph, stackLayer } from '../src/lib/data/graph'
import { NodeLocator } from '../src/lib/routing/nodeLocator'
import { parseCandidates } from '../src/lib/routing/candidates'
import { Planner } from '../src/lib/routing/planner'
import { EdgeWeights } from '../src/lib/routing/edgeWeights'
import { ShortestPaths } from '../src/lib/routing/shortestPaths'
import type { Twisty } from '../src/lib/data/twisties'
import type { LonLat } from '../src/lib/geo'
import { detourCosts, type KnownRoadContext } from './greatRoads'
import type { City } from './defects'
import { PlaceIndex } from './metrics'
import { ModelRecall } from './modelRecall'
import { planTrip, type TripTools } from './planTrip'
import type { LocatedRoad } from './roads'
import type { TripResult } from './results'
import type { BenchTrip } from './trips'

export interface WorkerSetup {
  dataDir: string
  roads: KnownRoadContext
  /** Roads rider-safety lists as unsafe, located. */
  bad: LocatedRoad[]
  /** Cities, towns and villages. */
  places: LonLat[]
  /** The cities among them, by name. */
  cities: City[]
  /** The overlay's twisties rated well enough for the model recall. */
  twisties: Twisty[]
}

export type ToWorker = { type: 'trip'; trip: BenchTrip } | { type: 'finish' }
export type FromWorker =
  | { type: 'ready' }
  | { type: 'result'; result: TripResult }
  | { type: 'finished'; deterministic: boolean; checked?: string }

const toArrayBuffer = (path: string): ArrayBuffer => {
  const bytes = readFileSync(path)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

/** Plans the trips it is given on its own copy of the graph; the stacked graph with tracks is only built if asked. */
export function runWorker(): void {
  const { dataDir, roads: knownRoads, bad, places, cities, twisties } = workerData as WorkerSetup
  const placeIndex = new PlaceIndex(places)
  const roads: Graph = parseGraph(toArrayBuffer(join(dataDir, 'graph.bin')))
  // The candidates the app downloads; a data folder from before `make candidates` has the planner find them itself.
  const candidatesFile = join(dataDir, 'candidates.bin')
  const file = existsSync(candidatesFile) ? parseCandidates(roads, toArrayBuffer(candidatesFile)) : undefined
  interface Setup {
    planner: Planner
    locator: NodeLocator
    tools: TripTools
  }
  const setups = new Map<boolean, Setup>()
  const setupFor = (includeTracks: boolean): Setup => {
    if (!setups.has(includeTracks)) {
      const planner = new Planner(includeTracks ? stackLayer(roads, toArrayBuffer(join(dataDir, 'tracks.bin'))) : roads, file?.candidates, file?.legs)
      const locator = new NodeLocator(planner.graph)
      // One pair of searches serves the detour costs, the model recall and the pinned routes, one after the other.
      const [first, second] = [new ShortestPaths(planner.graph), new ShortestPaths(planner.graph, 'backward')]
      const weights = new EdgeWeights(planner.graph)
      const tools: TripTools = {
        great: { context: knownRoads, detourCosts: (trip, located) => detourCosts({ fromStart: first, fromEnd: second }, weights, trip, located) },
        bad,
        places: placeIndex,
        cities,
        loops: { searches: first, weights },
        pins: { graph: planner.graph, locator, searches: { forward: first, backward: second }, weights },
        recall: new ModelRecall(twisties, { locator, searches: { fromStart: first, fromEnd: second }, weights }),
      }
      setups.set(includeTracks, { planner, locator, tools })
    }
    return setups.get(includeTracks) as Setup
  }
  const plan = (trip: BenchTrip) => {
    const { planner, locator, tools } = setupFor(trip.includeTracks)
    return planTrip(planner, locator, trip, tools)
  }
  const send = (message: FromWorker) => parentPort?.postMessage(message)

  let first: { trip: BenchTrip; result: TripResult } | null = null
  parentPort?.on('message', (message: ToWorker) => {
    if (message.type === 'trip') {
      const result = plan(message.trip)
      first ??= { trip: message.trip, result }
      send({ type: 'result', result })
      return
    }
    // H10: planning is deterministic, so a second plan of the first trip must give the same routes.
    const again = first && plan(first.trip)
    const ids = (result: TripResult) => result.options.map((option) => option.routeId).join()
    send({ type: 'finished', deterministic: !first || !again || ids(first.result) === ids(again), checked: first?.trip.id })
  })
  send({ type: 'ready' })
}
