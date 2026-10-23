import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Graph, parseGraph } from '../src/lib/data/graph'
import type { LonLat } from '../src/lib/geo'
import { parseCandidates } from '../src/lib/routing/candidates'
import { NodeLocator } from '../src/lib/routing/nodeLocator'
import { Planner } from '../src/lib/routing/planner'
import type { RideOption } from '../src/lib/routing/ride'
import { trackEdgeCount, walkProblem, wrongWayM } from './checks'
import { carriagewayUTurns } from './metrics'

/** A trip through the rider's stops, as `via-trips.json` lists it. */
export interface ViaTrip {
  id: string
  /** Of each point, start to finish. */
  names: string[]
  points: LonLat[]
  note?: string
}

/**
 * The trips with stops (plans/2026-10-18-via-points-planner.md, section 6), report only until they have a baseline: per
 * trip, each option's extra time, twisty km and the leg its extra time went to, the share of options Google Maps pins end
 * to end, and the time to plan; and the hard checks (H7 connected, H8 no tracks, H13 one-way, H14 carriageway U-turns) on
 * each leg on its own, since a ride may turn back at a stop. Returns the number of failures.
 */
export function viaReport(dataDir: string, tripsPath: string, out: string): number {
  const bytes = (file: string) => {
    const buffer = readFileSync(join(dataDir, file))
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  }
  const graph = parseGraph(bytes('graph.bin'))
  const { candidates, legs } = parseCandidates(graph, bytes('candidates.bin'))
  const planner = new Planner(graph, candidates, legs)
  const locator = new NodeLocator(graph)
  const { trips } = JSON.parse(readFileSync(tripsPath, 'utf8')) as { trips: ViaTrip[] }
  const lines = ['# Trips with stops', '', 'Report only (`make bench-via`). Extra time per leg is against the fastest ride\'s same leg.', '']
  const failures: string[] = []
  for (const trip of trips) {
    const started = performance.now()
    let options: RideOption[]
    try {
      options = planner.plan(trip.points)
    } catch (error) {
      failures.push(`${trip.id}: H1 plans: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    const ms = performance.now() - started
    const nodes = trip.points.map((point) => locator.nearest(point))
    options.forEach((option, stop) => {
      for (const problem of legProblems(graph, option, nodes, (edges, start, end) => [
        walkProblem(graph, edges, start, end),
        trackEdgeCount(graph, edges) > 0 ? 'H8 rides tracks' : null,
        wrongWayM(graph, edges, start) > 0 ? 'H13 rides against a one-way' : null,
        carriagewayUTurns(graph, edges, start) > 0 ? 'H14 turns back from one carriageway onto the other' : null,
      ])) {
        failures.push(`${trip.id}: stop ${stop}: ${problem}`)
      }
    })
    const [fastest] = options
    const planned = `Planned in ${Math.round(ms)} ms; ${options.filter((o) => o.pinnedAll).length} of ${options.length} options pinned end to end.`
    lines.push(`## ${trip.id}: ${trip.names.join(' → ')}`, '', [trip.note, planned].filter(Boolean).join('. '), '')
    lines.push('| extra | twisty km | extra per leg (min) | twisties per leg |', '| --- | --- | --- | --- |')
    for (const option of options) {
      const extraPerLeg = option.legs.map((leg, i) => Math.round((leg.timeS - fastest.legs[i].timeS) / 60))
      const twistiesPerLeg = option.legs.map((_, i) => option.twisties.filter((twisty) => twisty.leg === i).length)
      lines.push(`| +${Math.round(option.extraS / 60)} min | ${(option.twistyM / 1000).toFixed(0)} | ${extraPerLeg.join(' / ')} | ${twistiesPerLeg.join(' / ')} |`)
    }
    lines.push('')
  }
  lines.push('## Failures', '', ...(failures.length ? failures.map((failure) => `- ${failure}`) : ['None.']), '')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'via.md'), lines.join('\n'))
  console.log(`${trips.length} trips with stops, ${failures.length} failures: ${join(out, 'via.md')}`)
  return failures.length
}

/** The problems of each leg of the option, its edges cut where the legs' times add up. */
function legProblems(graph: Graph, option: RideOption, nodes: number[], check: (edges: number[], start: number, end: number) => (string | null)[]): string[] {
  const problems: string[] = []
  let first = 0
  option.legs.forEach((leg, i) => {
    let timeS = 0
    let last = first
    while (last < option.edges.length && timeS < leg.timeS - 1e-6) timeS += graph.edgeTimeS[option.edges[last++]]
    const found = check(option.edges.slice(first, last), nodes[i], nodes[i + 1]).filter((problem) => problem !== null)
    problems.push(...found.map((problem) => `leg ${i}: ${problem}`))
    first = last
  })
  return problems
}
