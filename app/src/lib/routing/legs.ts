import type { Graph } from '../data/graph'
import type { Candidate } from './candidates'
import { EdgeWeights } from './edgeWeights'
import { ShortestPaths } from './shortestPaths'

/** Legs between two roads of a chain are looked up in the table up to this long; longer ones go along the fastest route. */
export const LEG_RADIUS_S = 20 * 60

/**
 * The fastest legal ways between the ends of the candidates, time only and with tracks closed, up to LEG_RADIUS_S: what
 * chains of roads are made of (orienteering.ts). The graph is directed, so the leg from one end to another is not the leg
 * back. Indexed by end, so roads that share an end share its legs.
 */
export interface LegTable {
  /** The graph node of each end, sorted. */
  ends: Uint32Array
  /** The legs from end i are `start[i]` to `start[i + 1]`. */
  start: Uint32Array
  /** For each leg: the end it reaches, its time and the fun-weighted metres on it. */
  target: Uint16Array
  timeS: Uint16Array
  funM: Uint16Array
  /**
   * The adjacency slot (see Graph.adjacencyStart) its first edge leaves its end by, and its last edge comes into the end
   * it reaches by: a leg that leaves a road back along it, or comes into the next one along it, rides an edge twice.
   */
  firstSlot: Uint8Array
  lastSlot: Uint8Array
}

/** A leg from an end, as the planner chains roads with it. */
export interface EndLeg {
  timeS: number
  funM: number
  firstSlot: number
  lastSlot: number
}

/** The legs from the end at `node`, by the node each one reaches; none when the node is not an end. */
export function legsOfEnd(table: LegTable, node: number): Map<number, EndLeg> {
  const legs = new Map<number, EndLeg>()
  const at = sortedIndex(table.ends, node)
  if (table.ends[at] !== node) return legs
  for (let i = table.start[at]; i < table.start[at + 1]; i++) {
    legs.set(table.ends[table.target[i]], { timeS: table.timeS[i], funM: table.funM[i], firstSlot: table.firstSlot[i], lastSlot: table.lastSlot[i] })
  }
  return legs
}

/** The slot of `edge` among the edges of `node`. */
export function slotOf(graph: Graph, node: number, edge: number): number {
  for (let i = graph.adjacencyStart[node]; i < graph.adjacencyStart[node + 1]; i++) if (graph.adjacencyEdge[i] === edge) return i - graph.adjacencyStart[node]
  throw new Error(`Edge ${edge} does not meet node ${node}`)
}

function sortedIndex(sorted: Uint32Array, value: number): number {
  let [low, high] = [0, sorted.length]
  while (low < high) {
    const middle = (low + high) >> 1
    if (sorted[middle] < value) low = middle + 1
    else high = middle
  }
  return low
}

/** Built once with the candidates (`make candidates`); a phone given no table builds one only for a small graph. */
export function buildLegTable(graph: Graph, candidates: Candidate[], radiusS = LEG_RADIUS_S): LegTable {
  const ends = Uint32Array.from(new Set(candidates.flatMap((candidate) => candidate.ends))).sort()
  if (ends.length > 0xffff) throw new Error(`${ends.length} candidate ends do not fit the leg table`)
  const weights = new EdgeWeights(graph).use(0, false)
  const search = new ShortestPaths(graph)
  const start = new Uint32Array(ends.length + 1)
  const [target, timeS, funM, firstSlot, lastSlot]: number[][] = [[], [], [], [], []]
  ends.forEach((node, from) => {
    start[from] = target.length
    search.search(node, { weights, optionalTargets: ends, optionalLimit: radiusS })
    ends.forEach((other, to) => {
      const costS = search.costTo(other)
      if (to === from || !(costS <= radiusS)) return
      const edges = search.edgesTo(other)
      target.push(to)
      timeS.push(Math.round(costS))
      funM.push(Math.min(0xffff, Math.round(edges.reduce((sum, edge) => sum + graph.edgeFunM[edge], 0))))
      firstSlot.push(slotOf(graph, node, edges[0]))
      lastSlot.push(slotOf(graph, other, edges[edges.length - 1]))
    })
  })
  start[ends.length] = target.length
  return {
    ends,
    start,
    target: Uint16Array.from(target),
    timeS: Uint16Array.from(timeS),
    funM: Uint16Array.from(funM),
    firstSlot: Uint8Array.from(firstSlot),
    lastSlot: Uint8Array.from(lastSlot),
  }
}

/** The leg arrays' bytes: three u16 and two u8 per leg, padded to a whole word. */
const legBytes = (legs: number) => Math.ceil((legs * 8) / 4) * 4

/** The table as 32-bit words: end count, leg count, ends, starts, then the u16 arrays and the u8 ones. */
export function legWords(table: LegTable): Uint32Array {
  const legs = table.target.length
  const words = new Uint32Array(2 + table.ends.length + table.start.length + legBytes(legs) / 4)
  words[0] = table.ends.length
  words[1] = legs
  words.set(table.ends, 2)
  words.set(table.start, 2 + table.ends.length)
  const at = (2 + table.ends.length + table.start.length) * 4
  const halves = new Uint16Array(words.buffer, at, legs * 3)
  halves.set(table.target, 0)
  halves.set(table.timeS, legs)
  halves.set(table.funM, legs * 2)
  const bytes = new Uint8Array(words.buffer, at + legs * 6, legs * 2)
  bytes.set(table.firstSlot, 0)
  bytes.set(table.lastSlot, legs)
  return words
}

/** The table stored at word `at` of `buffer`, as views into it; throws on a section that does not fit. */
export function legTableAt(buffer: ArrayBuffer, at: number, nodeCount: number): LegTable {
  const words = new Uint32Array(buffer)
  if (words.length < at + 2) throw new Error('Truncated leg table')
  const [endCount, legs] = [words[at], words[at + 1]]
  const halvesAt = at + 2 + endCount * 2 + 1
  if (words.length !== halvesAt + legBytes(legs) / 4) throw new Error(`Leg table of ${words.length - at} words, expected ${halvesAt - at + legBytes(legs) / 4}`)
  const ends = words.subarray(at + 2, at + 2 + endCount)
  const start = words.subarray(at + 2 + endCount, halvesAt)
  if (ends.some((node) => node >= nodeCount) || start[endCount] !== legs) throw new Error('Leg table outside the graph')
  const halves = (offset: number) => new Uint16Array(buffer, halvesAt * 4 + offset * legs * 2, legs)
  const bytes = (offset: number) => new Uint8Array(buffer, halvesAt * 4 + legs * 6 + offset * legs, legs)
  return { ends, start, target: halves(0), timeS: halves(1), funM: halves(2), firstSlot: bytes(0), lastSlot: bytes(1) }
}
