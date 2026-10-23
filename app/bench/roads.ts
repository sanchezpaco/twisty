import { readFileSync } from 'node:fs'
import { edgeCoordinates, type Graph, nodePosition } from '../src/lib/data/graph'
import { haversineM, type LonLat } from '../src/lib/geo'
import { MinHeap } from '../src/lib/routing/heap'

/** The farthest a point of a known road may be from the road's own nodes in the graph. */
export const SNAP_MAX_M = 500
/** A road counts as ridden where an option's geometry stays this close to it... */
export const RIDDEN_TOLERANCE_M = 50
/** ...for at least this share of its length. */
export const RIDDEN_SHARE = 0.8
const RESAMPLE_STEP_M = 50
/** A road end that reaches fewer nodes than this without the road itself is a pocket (a village, a sanctuary), not the network. */
export const DEAD_END_REACH_NODES = 1_000
// A label with one part is a ref when it looks like one ("CV-35", "Ma-4040B"), else a name ("Carretera de Tost").
const REF_PATTERN = /^[A-Za-zÑñ]{1,5}-?\d+[A-Za-z]{0,2}$/
const LABEL_SEPARATOR = ' · '

/** A road riders know is great, as road-scout writes it in `great-roads.json`. */
export interface KnownRoad {
  id: string
  /** Edges match when their ref equals this exactly, and when their name equals `name` if that is given too. */
  ref?: string
  name?: string
  region: string
  from: LonLat
  via?: LonLat[]
  to: LonLat
  why: string
  /** True when the road ends in the graph (a sanctuary, a village at the end of the valley); worked out otherwise. */
  deadEnd?: boolean
  /** A trip a rider would plan that passes the road. */
  trip?: { from: LonLat; to: LonLat; fromName?: string; toName?: string }
  addedBy: string
  addedOn: string
}

export interface RoadList {
  /** Roads added after this date are held out of tuning. */
  tunedThrough: string | null
  roads: KnownRoad[]
}

export function readRoads(path: string): RoadList {
  return JSON.parse(readFileSync(path, 'utf8')) as RoadList
}

export interface LocatedRoad {
  id: string
  edges: number[]
  line: LonLat[]
  lengthM: number
  timeS: number
  startNode: number
  endNode: number
  deadEnd: boolean
}

/** What the bench knows about one entry of `great-roads.json`: where it is in the graph, or why it is not. */
export interface RoadStatus {
  road: KnownRoad
  located: LocatedRoad | null
  unlocatable: string | null
  /** Share of the road that lies on a twisty of the overlay (`twisties.json`). */
  overlay: number | null
  /** Share of the road's length that the graph counts as fun: the overlay can rate a road the planner finds dull. */
  funShare: number | null
}

export function funShare(graph: Graph, road: LocatedRoad): number {
  const sum = (values: Float32Array) => road.edges.reduce((total, edge) => total + values[edge], 0)
  return sum(graph.edgeFunM) / sum(graph.edgeLengthM)
}

export type Location = { located: LocatedRoad } | { unlocatable: string }

/** Splits a graph label ("CV-35 · Carretera València - Ademuz") into the ref and the name it carries. */
export function labelParts(label: string): { ref?: string; name?: string } {
  const [first, second] = label.split(LABEL_SEPARATOR)
  if (second !== undefined) return { ref: first, name: second }
  if (!first) return {}
  return REF_PATTERN.test(first) ? { ref: first } : { name: first }
}

export function matchesRoad(label: string, road: Pick<KnownRoad, 'ref' | 'name'>): boolean {
  const parts = labelParts(label)
  return (road.ref === undefined || parts.ref === road.ref) && (road.name === undefined || parts.name === road.name)
}

/** Finds the road in the graph: the path along matching edges between its points. */
export function locateRoad(graph: Graph, road: KnownRoad, reachNodes = DEAD_END_REACH_NODES): Location {
  if (road.ref === undefined && road.name === undefined) return { unlocatable: 'the entry has neither a ref nor a name' }
  const matchingRoad = graph.roadNames.map((label) => matchesRoad(label, road))
  const neighbours = new Map<number, { node: number; edge: number }[]>()
  const add = (from: number, node: number, edge: number) => neighbours.set(from, [...(neighbours.get(from) ?? []), { node, edge }])
  for (let edge = 0; edge < graph.edgeCount; edge++) {
    if (!matchingRoad[graph.edgeRoad[edge]]) continue
    add(graph.edgeFrom[edge], graph.edgeTo[edge], edge)
    add(graph.edgeTo[edge], graph.edgeFrom[edge], edge)
  }
  if (neighbours.size === 0) return { unlocatable: 'no edge of the graph has that ref and name' }

  const points = [road.from, ...(road.via ?? []), road.to]
  const nodes: number[] = []
  for (const [index, point] of points.entries()) {
    const node = nearestNode(graph, [...neighbours.keys()], point)
    if (node === null) return { unlocatable: `no node of the road within ${SNAP_MAX_M} m of point ${index} (${point.join(', ')})` }
    nodes.push(node)
  }
  const edges: number[] = []
  for (let leg = 1; leg < nodes.length; leg++) {
    const part = shortestAlong(graph, neighbours, nodes[leg - 1], nodes[leg])
    if (!part) return { unlocatable: `the matching edges do not connect point ${leg - 1} to point ${leg}` }
    edges.push(...part)
  }
  return { located: describe(graph, road, nodes[0], nodes[nodes.length - 1], edges, reachNodes) }
}

function nearestNode(graph: Graph, candidates: number[], point: LonLat): number | null {
  let best: number | null = null
  let bestM = SNAP_MAX_M
  for (const node of candidates) {
    const distance = haversineM(point, nodePosition(graph, node))
    if (distance <= bestM) [best, bestM] = [node, distance]
  }
  return best
}

/** Dijkstra by length over the matching edges only. */
function shortestAlong(graph: Graph, neighbours: Map<number, { node: number; edge: number }[]>, from: number, to: number): number[] | null {
  const cost = new Map<number, number>([[from, 0]])
  const via = new Map<number, { node: number; edge: number }>()
  const heap = new MinHeap()
  const settled = new Set<number>()
  heap.push(from, 0)
  while (heap.size > 0) {
    const key = heap.peekKey()
    const node = heap.pop()
    if (settled.has(node)) continue
    settled.add(node)
    if (node === to) break
    for (const next of neighbours.get(node) ?? []) {
      const total = key + graph.edgeLengthM[next.edge]
      if (total < (cost.get(next.node) ?? Infinity)) {
        cost.set(next.node, total)
        via.set(next.node, { node, edge: next.edge })
        heap.push(next.node, total)
      }
    }
  }
  if (!settled.has(to)) return null
  const edges: number[] = []
  for (let node = to; node !== from; ) {
    const step = via.get(node) as { node: number; edge: number }
    edges.push(step.edge)
    node = step.node
  }
  return edges.reverse()
}

function describe(graph: Graph, road: KnownRoad, startNode: number, endNode: number, edges: number[], reachNodes: number): LocatedRoad {
  const line: LonLat[] = []
  let node = startNode
  for (const edge of edges) {
    line.push(...edgeCoordinates(graph, edge, node))
    node = graph.edgeFrom[edge] === node ? graph.edgeTo[edge] : graph.edgeFrom[edge]
  }
  line.push(nodePosition(graph, node))
  const own = new Set(edges)
  return {
    id: road.id,
    edges,
    line,
    lengthM: edges.reduce((sum, edge) => sum + graph.edgeLengthM[edge], 0),
    timeS: edges.reduce((sum, edge) => sum + graph.edgeTimeS[edge], 0),
    startNode,
    endNode,
    deadEnd: road.deadEnd ?? !(reachesNetwork(graph, startNode, own, reachNodes) && reachesNetwork(graph, endNode, own, reachNodes)),
  }
}

/** Whether the node still reaches `reachNodes` nodes when the road's own edges are left out (a bounded breadth-first search). */
function reachesNetwork(graph: Graph, node: number, roadEdges: Set<number>, reachNodes: number): boolean {
  const seen = new Set([node])
  const queue = [node]
  for (let next = 0; next < queue.length && seen.size < reachNodes; next++) {
    const at = queue[next]
    for (let i = graph.adjacencyStart[at]; i < graph.adjacencyStart[at + 1]; i++) {
      const neighbour = graph.adjacencyNode[i]
      if (roadEdges.has(graph.adjacencyEdge[i]) || seen.has(neighbour)) continue
      seen.add(neighbour)
      queue.push(neighbour)
    }
  }
  return seen.size >= reachNodes
}

/** Points along a line every `stepM`, ends included. */
export function resample(line: LonLat[], stepM = RESAMPLE_STEP_M): LonLat[] {
  const points: LonLat[] = [line[0]]
  let carried = 0
  for (let i = 1; i < line.length; i++) {
    const segmentM = haversineM(line[i - 1], line[i])
    for (let along = stepM - carried; along <= segmentM; along += stepM) {
      const t = along / segmentM
      points.push([line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t])
    }
    carried = (carried + segmentM) % stepM
  }
  points.push(line[line.length - 1])
  return points
}

const CELL_DEGREES = 0.002
const M_PER_DEGREE = 111_000

/** Distance from a point to a set of polylines, looked up through a grid of their segments. */
export class PolylineIndex {
  private readonly cells = new Map<string, [LonLat, LonLat][]>()

  constructor(lines: LonLat[][]) {
    for (const line of lines) {
      for (let i = 1; i < line.length; i++) {
        const [a, b] = [line[i - 1], line[i]]
        const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])].map((lon) => Math.floor(lon / CELL_DEGREES))
        const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])].map((lat) => Math.floor(lat / CELL_DEGREES))
        for (let x = x0; x <= x1; x++) {
          for (let y = y0; y <= y1; y++) this.cellAt(x, y).push([a, b])
        }
      }
    }
  }

  /** Metres to the nearest segment within a cell of the point, or Infinity when there is none that close. */
  distanceM(point: LonLat): number {
    const [cx, cy] = [Math.floor(point[0] / CELL_DEGREES), Math.floor(point[1] / CELL_DEGREES)]
    let best = Infinity
    for (let x = cx - 1; x <= cx + 1; x++) {
      for (let y = cy - 1; y <= cy + 1; y++) {
        for (const [a, b] of this.cells.get(`${x}:${y}`) ?? []) best = Math.min(best, distanceToSegmentM(point, a, b))
      }
    }
    return best
  }

  private cellAt(x: number, y: number): [LonLat, LonLat][] {
    const key = `${x}:${y}`
    const cell = this.cells.get(key) ?? []
    this.cells.set(key, cell)
    return cell
  }
}

function distanceToSegmentM(point: LonLat, a: LonLat, b: LonLat): number {
  const scale = Math.cos((point[1] * Math.PI) / 180)
  const [bx, by] = [(b[0] - a[0]) * scale, b[1] - a[1]]
  const [px, py] = [(point[0] - a[0]) * scale, point[1] - a[1]]
  const lengthSquared = bx * bx + by * by
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared))
  return Math.hypot(px - bx * t, py - by * t) * M_PER_DEGREE
}

/** The share of a road lying within `RIDDEN_TOLERANCE_M` of the lines in `index`. */
export function coveredShare(index: PolylineIndex, roadLine: LonLat[]): number {
  const samples = resample(roadLine)
  return samples.filter((sample) => index.distanceM(sample) <= RIDDEN_TOLERANCE_M).length / samples.length
}

export const isRidden = (index: PolylineIndex, roadLine: LonLat[]): boolean => coveredShare(index, roadLine) >= RIDDEN_SHARE
