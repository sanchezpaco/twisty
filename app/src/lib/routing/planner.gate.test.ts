import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readBaseline } from '../../../bench/baseline'
import { optionRecord } from '../../../bench/results'
import { readTrips } from '../../../bench/trips'
import { type Graph, parseGraph, stackLayer } from '../data/graph'
import { parseCandidates } from './candidates'
import { Planner } from './planner'
import type { RideOption } from './ride'

/**
 * Speed work must not change a single route: the trips tagged `gate` in `bench/trips.json` are planned and every option
 * must match the one recorded in `bench/baseline.jsonl`. Skipped when the data has not been built.
 *
 * Options are compared by `presentation`, which hashes everything a rider sees but the edge ids, so a data build that only
 * renumbers the graph must pass too: `TWISTY_DATA=<folder> npx vitest run src/lib/routing/planner.gate.test.ts`.
 * After a change that is meant to alter routes, re-baseline with `make bench-baseline`.
 */
const DATA_DIR = process.env.TWISTY_DATA ? pathToFileURL(`${process.env.TWISTY_DATA}/`) : new URL('../../../public/data/', import.meta.url)
const BENCH_DIR = new URL('../../../bench/', import.meta.url)
const hasData = existsSync(new URL('graph.bin', DATA_DIR)) && existsSync(new URL('tracks.bin', DATA_DIR))

const toArrayBuffer = (file: string): ArrayBuffer => {
  const bytes = readFileSync(new URL(file, DATA_DIR))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

const summary = (graph: Graph, options: RideOption[]) =>
  options.map((option) => {
    const { timeS, curvyM, distanceM, presentation } = optionRecord(graph, option)
    return { timeS, curvyM, distanceM, presentation }
  })

describe.skipIf(!hasData)('Planner gate: speed work keeps every route', () => {
  const baseline = readBaseline(new URL('baseline.jsonl', BENCH_DIR).pathname)
  const trips = readTrips(new URL('trips.json', BENCH_DIR).pathname).filter((trip) => trip.tags?.includes('gate'))
  // Read by the first test, not while the suite is collected: a skipped suite's body still runs, and CI has no data.
  let data: { roads: Graph; file?: ReturnType<typeof parseCandidates> } | undefined
  const load = () => {
    if (!data) {
      const roads = parseGraph(toArrayBuffer('graph.bin'))
      // The candidates the app downloads and the bench loads, found on the roads layer alone; tracks trips plan with the same ones.
      data = { roads, file: existsSync(new URL('candidates.bin', DATA_DIR)) ? parseCandidates(roads, toArrayBuffer('candidates.bin')) : undefined }
    }
    return data
  }
  const planners = new Map<boolean, Planner>()
  const plannerFor = (includeTracks: boolean) => {
    if (!planners.has(includeTracks)) {
      const { roads, file } = load()
      planners.set(includeTracks, new Planner(includeTracks ? stackLayer(roads, toArrayBuffer('tracks.bin')) : roads, file?.candidates, file?.legs))
    }
    return planners.get(includeTracks) as Planner
  }

  it('is on the baseline extract', () => {
    const { source, nodes, edges } = JSON.parse(readFileSync(new URL('meta.json', DATA_DIR), 'utf8'))
    expect({ source, nodes, edges }, 're-baseline: the data is not the baseline\'s').toEqual(baseline?.header.data)
  })

  it.each(trips.map((trip) => [trip.id, trip] as const))('%s: every option as recorded', (id, trip) => {
    const recorded = baseline?.results.get(id)
    expect(recorded, `${id} is not in bench/baseline.jsonl`).toBeDefined()
    const planner = plannerFor(trip.includeTracks)
    const early: RideOption[] = []
    const options = planner.plan([trip.from, trip.to], { includeTracks: trip.includeTracks }, (option) => early.push(option))
    expect(summary(planner.graph, early), 'the early fastest ride is the first option').toEqual(summary(planner.graph, [options[0]]))
    expect(summary(planner.graph, options)).toEqual(
      recorded?.options.map(({ timeS, curvyM, distanceM, presentation }) => ({ timeS, curvyM, distanceM, presentation })),
    )
  }, 120_000)
})
