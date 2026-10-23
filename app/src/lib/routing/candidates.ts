import { type Graph, RoadClass } from '../data/graph'
import { type LegTable, legTableAt, legWords } from './legs'
import { CURVY_EDGE_SHARE, MAX_TWISTY_GAP_M, MIN_TWISTY_LENGTH_M, UNNAMED } from './ride'

/** A twisty road as the graph has it, whatever trip is planned: the edges in riding order from one end to the other. */
export interface Candidate {
  edges: number[]
  /** Nodes at its two ends. */
  ends: [number, number]
  lengthM: number
  funM: number
}

/**
 * The long curvy roads of the graph. An edge is curvy as in `twistyStretches`. A road goes on through a node when one
 * curvy edge of the same road leaves it (a side road or another road does not stop it), or when nothing else meets
 * there (the same road is often mapped under two names); a short dull edge, a bridge or a village, does not stop it.
 */
export function findCandidates(graph: Graph): Candidate[] {
  const curvy = (edge: number) =>
    graph.edgeClass[edge] !== RoadClass.Track && graph.edgeFunM[edge] >= CURVY_EDGE_SHARE * graph.edgeLengthM[edge]
  const visited = new Uint8Array(graph.edgeCount)
  const candidates: Candidate[] = []
  for (let seed = 0; seed < graph.edgeCount; seed++) {
    if (visited[seed] || !curvy(seed)) continue
    visited[seed] = 1
    const forward = follow(graph, seed, graph.edgeTo[seed], curvy, visited)
    const backward = follow(graph, seed, graph.edgeFrom[seed], curvy, visited)
    const edges = [...backward.edges.reverse(), seed, ...forward.edges]
    const lengthM = edges.reduce((sum, edge) => sum + graph.edgeLengthM[edge], 0)
    if (lengthM < MIN_TWISTY_LENGTH_M) continue
    candidates.push({
      edges,
      ends: [backward.end, forward.end],
      lengthM,
      funM: edges.reduce((sum, edge) => sum + graph.edgeFunM[edge], 0),
    })
  }
  return candidates
}

/** The edges that continue `from` beyond `node`, ending at the last curvy one, and the node where the road stops. */
function follow(
  graph: Graph,
  from: number,
  node: number,
  curvy: (edge: number) => boolean,
  visited: Uint8Array,
): { edges: number[]; end: number } {
  const edges: number[] = []
  let [lastCurvy, endOfCurvy, gapM] = [0, node, 0]
  for (let edge = from; ; ) {
    const next = continuation(graph, edge, node, curvy)
    if (next < 0 || visited[next]) break
    node = graph.edgeFrom[next] === node ? graph.edgeTo[next] : graph.edgeFrom[next]
    edges.push(next)
    edge = next
    if (curvy(next)) {
      visited[next] = 1
      ;[lastCurvy, endOfCurvy, gapM] = [edges.length, node, 0]
    } else {
      gapM += graph.edgeLengthM[next]
      if (gapM > MAX_TWISTY_GAP_M) break
    }
  }
  return { edges: edges.slice(0, lastCurvy), end: endOfCurvy }
}

function continuation(graph: Graph, edge: number, node: number, curvy: (edge: number) => boolean): number {
  const { adjacencyStart, adjacencyEdge } = graph
  const others: number[] = []
  for (let i = adjacencyStart[node]; i < adjacencyStart[node + 1]; i++) {
    if (adjacencyEdge[i] !== edge && graph.edgeClass[adjacencyEdge[i]] !== RoadClass.Track) others.push(adjacencyEdge[i])
  }
  const sameRoad = others.filter((other) => graph.edgeRoad[other] === graph.edgeRoad[edge] && graph.edgeRoad[edge] !== UNNAMED)
  const sameCurvy = sameRoad.filter(curvy)
  if (sameCurvy.length === 1) return sameCurvy[0]
  if (sameCurvy.length === 0 && sameRoad.length === 1) return sameRoad[0]
  return others.length === 1 && adjacencyStart[node + 1] - adjacencyStart[node] === 2 ? others[0] : -1
}

const MAGIC = 'TWC3'
const HEADER_WORDS = 4

/** The candidates and the legs between their ends, as read from a download. */
export interface CandidateFile {
  candidates: Candidate[]
  legs: LegTable
}

/**
 * The candidates as the app downloads them next to `graph.bin`, with the legs between their ends (legs.ts): found once
 * at build time, not on every phone. The header holds the node and edge count of the graph they were found in, so that a
 * file of another build is refused.
 */
export function serialiseCandidates(graph: Graph, candidates: Candidate[], legs: LegTable): ArrayBuffer {
  const total = candidates.reduce((sum, candidate) => sum + candidate.edges.length, 0)
  const candidateWords = HEADER_WORDS + candidates.length + 1 + candidates.length * 2 + total
  const legSection = legWords(legs)
  const buffer = new ArrayBuffer((candidateWords + legSection.length) * 4)
  new Uint8Array(buffer).set(new TextEncoder().encode(MAGIC))
  const words = new Uint32Array(buffer)
  words[1] = candidates.length
  words[2] = graph.nodeCount
  words[3] = graph.edgeCount
  const [starts, ends, edges] = [HEADER_WORDS, HEADER_WORDS + candidates.length + 1, HEADER_WORDS + candidates.length + 1 + candidates.length * 2]
  let position = 0
  candidates.forEach((candidate, index) => {
    words[starts + index] = position
    words.set(candidate.ends, ends + index * 2)
    words.set(candidate.edges, edges + position)
    position += candidate.edges.length
  })
  words[starts + candidates.length] = position
  words.set(legSection, candidateWords)
  return buffer
}

const magicOf = (buffer: ArrayBuffer) => new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength)))

/** Throws unless the file is a candidates file made from this very graph. */
export function parseCandidates(graph: Graph, buffer: ArrayBuffer): CandidateFile {
  const magic = magicOf(buffer)
  if (magic !== MAGIC) throw new Error(`Unexpected candidates file (magic "${magic}")`)
  if (buffer.byteLength < HEADER_WORDS * 4 || buffer.byteLength % 4 !== 0) throw new Error(`Truncated candidates file (${buffer.byteLength} bytes)`)
  const words = new Uint32Array(buffer)
  const [count, nodeCount, edgeCount] = [words[1], words[2], words[3]]
  if (nodeCount !== graph.nodeCount || edgeCount !== graph.edgeCount) {
    throw new Error(`Candidates are of another graph (${nodeCount} nodes, ${edgeCount} edges; this one has ${graph.nodeCount}, ${graph.edgeCount})`)
  }
  const [starts, ends] = [HEADER_WORDS, HEADER_WORDS + count + 1]
  const edgesAt = ends + count * 2
  if (buffer.byteLength < edgesAt * 4) throw new Error(`Truncated candidates file (${buffer.byteLength} bytes)`)
  const total = words[starts + count]
  if (buffer.byteLength < (edgesAt + total) * 4) throw new Error(`Candidates file of ${buffer.byteLength} bytes, shorter than its candidates`)
  const candidates = Array.from({ length: count }, (_, index) => {
    const [from, to] = [words[starts + index], words[starts + index + 1]]
    if (from > to || to > total) throw new Error(`Candidate ${index} has a bad range of edges`)
    const road = Array.from(words.subarray(edgesAt + from, edgesAt + to))
    const nodes = [words[ends + index * 2], words[ends + index * 2 + 1]] as [number, number]
    if (road.some((edge) => edge >= edgeCount) || nodes.some((node) => node >= nodeCount)) throw new Error(`Candidate ${index} is outside the graph`)
    return {
      edges: road,
      ends: nodes,
      lengthM: road.reduce((sum, edge) => sum + graph.edgeLengthM[edge], 0),
      funM: road.reduce((sum, edge) => sum + graph.edgeFunM[edge], 0),
    }
  })
  return { candidates, legs: legTableAt(buffer, edgesAt + total, nodeCount) }
}

/**
 * The candidates of a download, or undefined when there are none to use: a missing file that a dev server answers with its
 * page is not a candidates file, and a file of another graph or format is reported to `onMismatch`. The planner then finds
 * them itself.
 */
export function candidatesOfDownload(graph: Graph, buffer: ArrayBuffer, onMismatch: (error: Error) => void): CandidateFile | undefined {
  if (!magicOf(buffer).startsWith('TWC')) return undefined
  try {
    return parseCandidates(graph, buffer)
  } catch (error) {
    onMismatch(error as Error)
    return undefined
  }
}
