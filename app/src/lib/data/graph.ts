import type { LonLat } from '../geo'

export const RoadClass = {
  Motorway: 0,
  Trunk: 1,
  Primary: 2,
  Secondary: 3,
  Tertiary: 4,
  Unclassified: 5,
  Link: 6,
  /** Anything unpaved; only routed when the rider opts in. */
  Track: 7,
  /** A short residential street kept to join the dead end of a road to the network. */
  Residential: 8,
} as const

/**
 * A turn from one one-way edge onto another this sharp or more is a U-turn, banned: one carriageway onto the other where a
 * road divides, or a ramp taken back the way it came. Two-way roads keep their hairpins. At 170 deg, U-turns of 157-169 deg
 * at real divides (N-340, N-3, A-624) went through.
 */
export const U_TURN_DEG = 150
/**
 * Where a split road ends (one two-way edge and the two carriageways meet at a node, nothing else), going from the one
 * coming in onto the one going out this sharply is turning back through the split. OSM almost never allows it where it
 * says anything: of Spain's 14,011 such turns of 120-150 deg, 5,251 are tagged forbidden and 40 allowed (2026-10-18;
 * at 60-90 deg, 25 forbidden of 17,067).
 */
export const SPLIT_END_U_TURN_DEG = 120
/**
 * A split road's end is told from a roundabout by the road going on: it leaves the node at least this far from both
 * carriageways. Where a road joins a tight roundabout, the ring's two edges also meet one two-way edge, and their headings
 * 15 m along the ring read as a sharp turn (125 deg at the C-462's in Berga).
 */
const SPLIT_END_ROAD_DEG = 120
const HEADING_STEPS = 256
// A stored heading is rounded to a step, so a turn the drawn line makes at U_TURN_DEG can read up to a step less: 149.06
// deg from the headings for 151 deg on the line, at a junction near Cabezón de la Sal (bench H14, 2026-10-19).
const HEADING_STEP_DEG = 360 / HEADING_STEPS

/** `edgeFlags` bits, as `pipeline/twisty_pipeline/graph.py` `EdgeFlag` writes them. */
export const EdgeFlag = {
  /** A conditional restriction closes it to motor traffic part of the year. */
  ClosedPartOfYear: 1,
  /** Open only to those with business there. */
  DestinationOnly: 2,
  /** In a town. */
  BuiltUp: 4,
} as const

export const OneWay = {
  No: 0,
  /** Ridden only from `edgeFrom` to `edgeTo`. */
  Yes: 1,
  /** A town's one-way street, ridden both ways: the graph lacks most of the town's streets. Its direction runs from `edgeFrom` to `edgeTo`. */
  InTown: 2,
} as const

/**
 * Road graph in typed arrays, with CSR adjacency for fast searches. Adjacency lists every edge at both of its nodes; a
 * one-way edge may only be ridden from `edgeFrom` to `edgeTo` (see `canRide`).
 */
export interface Graph {
  nodeCount: number
  edgeCount: number
  nodeLonLat: Float32Array
  edgeFrom: Uint32Array
  edgeTo: Uint32Array
  edgeTimeS: Float32Array
  edgeLengthM: Float32Array
  /** Fun-weighted length: a metre of perfect twisty road counts as one metre, a straight as zero. */
  edgeFunM: Float32Array
  edgeRoad: Uint32Array
  edgeClass: Uint8Array
  /** Share of each edge's length on narrow ways, 0..255: oncoming traffic in blind bends. */
  edgeNarrow: Uint8Array
  /** Lowest limit posted on each edge when it is at most 40 km/h, else 0. */
  edgePostedKmh: Uint8Array
  /** Ford nodes on each edge, as mapped (many are dry dips): the ride tells the rider, whatever the fun. */
  edgeFords: Uint8Array
  /** `OneWay`, by edge. */
  edgeOneway: Uint8Array
  /** Riding edge e from `edgeFrom` to `edgeTo`: its heading leaving `edgeFrom` at [2e], arriving at `edgeTo` at [2e + 1], in 1/256 turns. */
  edgeHeading: Uint8Array
  /** `EdgeFlag` bits, by edge. */
  edgeFlags: Uint8Array
  roadNames: string[]
  edgeGeometryOffset: Uint32Array
  geometryLonLat: Float32Array
  /** Neighbours of node n live at [adjacencyStart[n], adjacencyStart[n + 1]). */
  adjacencyStart: Uint32Array
  adjacencyEdge: Uint32Array
  adjacencyNode: Uint32Array
  /** `Ride` bits by adjacency slot: whether its edge may be ridden away from the node, and towards it. */
  adjacencyRide: Uint8Array
}

/**
 * Searches read the way an edge may be ridden from its adjacency slot, next to the edge and neighbour they read anyway:
 * a scattered lookup by edge was a measured share of the one-way graph's extra planning time.
 */
export const Ride = { Out: 1, In: 2 } as const

const MAGIC = 'TWG5'

type Layer = Omit<Graph, 'adjacencyStart' | 'adjacencyEdge' | 'adjacencyNode' | 'adjacencyRide'>

/** Parses the binary layout written by `pipeline/twisty_pipeline/export.py`. */
export function parseGraph(buffer: ArrayBuffer): Graph {
  return withAdjacency(parseLayer(buffer))
}

/** Adds a layer (the tracks) whose node and road indices continue the graph's own. */
export function stackLayer(graph: Graph, buffer: ArrayBuffer): Graph {
  const layer = parseLayer(buffer)
  return withAdjacency({
    nodeCount: graph.nodeCount + layer.nodeCount,
    edgeCount: graph.edgeCount + layer.edgeCount,
    nodeLonLat: concat(graph.nodeLonLat, layer.nodeLonLat),
    edgeFrom: concat(graph.edgeFrom, layer.edgeFrom),
    edgeTo: concat(graph.edgeTo, layer.edgeTo),
    edgeTimeS: concat(graph.edgeTimeS, layer.edgeTimeS),
    edgeLengthM: concat(graph.edgeLengthM, layer.edgeLengthM),
    edgeFunM: concat(graph.edgeFunM, layer.edgeFunM),
    edgeRoad: concat(graph.edgeRoad, layer.edgeRoad),
    edgeClass: concat(graph.edgeClass, layer.edgeClass),
    edgeNarrow: concat(graph.edgeNarrow, layer.edgeNarrow),
    edgePostedKmh: concat(graph.edgePostedKmh, layer.edgePostedKmh),
    edgeFords: concat(graph.edgeFords, layer.edgeFords),
    edgeOneway: concat(graph.edgeOneway, layer.edgeOneway),
    edgeHeading: concat(graph.edgeHeading, layer.edgeHeading),
    edgeFlags: concat(graph.edgeFlags, layer.edgeFlags),
    roadNames: graph.roadNames.concat(layer.roadNames),
    edgeGeometryOffset: concat(
      graph.edgeGeometryOffset.subarray(0, graph.edgeCount),
      layer.edgeGeometryOffset.map((offset) => offset + graph.geometryLonLat.length / 2),
    ),
    geometryLonLat: concat(graph.geometryLonLat, layer.geometryLonLat),
  })
}

function parseLayer(buffer: ArrayBuffer): Layer {
  const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 4))
  if (magic !== MAGIC) throw new Error(`Unexpected graph file (magic "${magic}")`)
  const [nodeCount, edgeCount, geometryCount, roadNamesBytes] = new Uint32Array(buffer, 4, 4)
  let offset = 20
  const take = <T>(make: (offset: number) => T, bytes: number): T => {
    const array = make(offset)
    offset += bytes
    return array
  }
  const nodeLonLat = take((o) => new Float32Array(buffer, o, nodeCount * 2), nodeCount * 8)
  const edgeFrom = take((o) => new Uint32Array(buffer, o, edgeCount), edgeCount * 4)
  const edgeTo = take((o) => new Uint32Array(buffer, o, edgeCount), edgeCount * 4)
  const edgeTimeS = take((o) => new Float32Array(buffer, o, edgeCount), edgeCount * 4)
  const edgeLengthM = take((o) => new Float32Array(buffer, o, edgeCount), edgeCount * 4)
  const edgeFunM = take((o) => new Float32Array(buffer, o, edgeCount), edgeCount * 4)
  const edgeRoad = take((o) => new Uint32Array(buffer, o, edgeCount), edgeCount * 4)
  const edgeGeometryOffset = take((o) => new Uint32Array(buffer, o, edgeCount + 1), (edgeCount + 1) * 4)
  const geometryLonLat = take((o) => new Float32Array(buffer, o, geometryCount * 2), geometryCount * 8)
  const edgeClass = take((o) => new Uint8Array(buffer, o, edgeCount), edgeCount)
  const edgeNarrow = take((o) => new Uint8Array(buffer, o, edgeCount), edgeCount)
  const edgePostedKmh = take((o) => new Uint8Array(buffer, o, edgeCount), edgeCount)
  const edgeFords = take((o) => new Uint8Array(buffer, o, edgeCount), edgeCount)
  const edgeOneway = take((o) => new Uint8Array(buffer, o, edgeCount), edgeCount)
  const edgeHeading = take((o) => new Uint8Array(buffer, o, edgeCount * 2), edgeCount * 2)
  const edgeFlags = take((o) => new Uint8Array(buffer, o, edgeCount), edgeCount)
  const roadNames: string[] = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset, roadNamesBytes)))
  return {
    nodeCount,
    edgeCount,
    nodeLonLat,
    edgeFrom,
    edgeTo,
    edgeTimeS,
    edgeLengthM,
    edgeFunM,
    edgeRoad,
    edgeClass,
    edgeNarrow,
    edgePostedKmh,
    edgeFords,
    edgeOneway,
    edgeHeading,
    edgeFlags,
    roadNames,
    edgeGeometryOffset,
    geometryLonLat,
  }
}

function withAdjacency(layer: Layer): Graph {
  return { ...layer, ...buildAdjacency(layer) }
}

type TypedArray = Float32Array | Uint32Array | Uint8Array

function concat<T extends TypedArray>(first: T, second: T): T {
  const result = new (first.constructor as new (length: number) => T)(first.length + second.length)
  result.set(first)
  result.set(second, first.length)
  return result
}

function buildAdjacency({ nodeCount, edgeFrom, edgeTo, edgeOneway }: Layer) {
  const degree = new Uint32Array(nodeCount + 1)
  for (let e = 0; e < edgeFrom.length; e++) {
    degree[edgeFrom[e] + 1]++
    degree[edgeTo[e] + 1]++
  }
  const adjacencyStart = new Uint32Array(nodeCount + 1)
  for (let n = 0; n < nodeCount; n++) adjacencyStart[n + 1] = adjacencyStart[n] + degree[n + 1]
  const cursor = adjacencyStart.slice(0, nodeCount)
  const adjacencyEdge = new Uint32Array(edgeFrom.length * 2)
  const adjacencyNode = new Uint32Array(edgeFrom.length * 2)
  const adjacencyRide = new Uint8Array(edgeFrom.length * 2)
  for (let e = 0; e < edgeFrom.length; e++) {
    const a = edgeFrom[e]
    const b = edgeTo[e]
    const oneWay = edgeOneway[e] === OneWay.Yes
    adjacencyEdge[cursor[a]] = e
    adjacencyRide[cursor[a]] = oneWay ? Ride.Out : Ride.Out | Ride.In
    adjacencyNode[cursor[a]++] = b
    adjacencyEdge[cursor[b]] = e
    adjacencyRide[cursor[b]] = oneWay ? Ride.In : Ride.Out | Ride.In
    adjacencyNode[cursor[b]++] = a
  }
  return { adjacencyStart, adjacencyEdge, adjacencyNode, adjacencyRide }
}

export function nodePosition(graph: Graph, node: number): LonLat {
  return [graph.nodeLonLat[node * 2], graph.nodeLonLat[node * 2 + 1]]
}

/** Coordinates of an edge walked starting at `fromNode`, excluding the final node. */
export function edgeCoordinates(graph: Graph, edge: number, fromNode: number): LonLat[] {
  const points: LonLat[] = [nodePosition(graph, fromNode)]
  const start = graph.edgeGeometryOffset[edge]
  const end = graph.edgeGeometryOffset[edge + 1]
  const inner: LonLat[] = []
  for (let i = start; i < end; i++) inner.push([graph.geometryLonLat[i * 2], graph.geometryLonLat[i * 2 + 1]])
  if (graph.edgeFrom[edge] !== fromNode) inner.reverse()
  return points.concat(inner)
}

export function otherEnd(graph: Graph, edge: number, node: number): number {
  return graph.edgeFrom[edge] === node ? graph.edgeTo[edge] : graph.edgeFrom[edge]
}

/** Whether the edge may be ridden starting at `fromNode`: a one-way edge only from its first node. */
export function canRide(graph: Graph, edge: number, fromNode: number): boolean {
  return graph.edgeOneway[edge] !== OneWay.Yes || graph.edgeFrom[edge] === fromNode
}

/** Whether going from `inEdge` through `node` onto `outEdge` is a banned U-turn (see `U_TURN_DEG` and `SPLIT_END_U_TURN_DEG`). */
export function isUTurn(graph: Graph, inEdge: number, node: number, outEdge: number): boolean {
  const { edgeOneway, edgeHeading, edgeFrom, edgeTo } = graph
  if (inEdge < 0 || outEdge < 0 || edgeOneway[inEdge] !== OneWay.Yes || edgeOneway[outEdge] !== OneWay.Yes) return false
  // A one-way edge is ridden from edgeFrom to edgeTo: it arrives at edgeTo and leaves edgeFrom.
  if (edgeTo[inEdge] !== node || edgeFrom[outEdge] !== node) return false
  const turnDeg = headingDifferenceDeg(edgeHeading[outEdge * 2], edgeHeading[inEdge * 2 + 1])
  return turnDeg >= U_TURN_DEG - HEADING_STEP_DEG || (turnDeg >= SPLIT_END_U_TURN_DEG && isSplitEnd(graph, node, inEdge, outEdge))
}

/**
 * Whether `node` is where a split road ends: besides the two carriageways only one edge meets it, not a one-way one, and it
 * leaves the node away from both of them.
 */
function isSplitEnd(graph: Graph, node: number, inEdge: number, outEdge: number): boolean {
  const { adjacencyStart, adjacencyEdge, edgeOneway, edgeHeading, edgeFrom } = graph
  if (adjacencyStart[node + 1] - adjacencyStart[node] !== 3) return false
  for (let i = adjacencyStart[node]; i < adjacencyStart[node + 1]; i++) {
    const road = adjacencyEdge[i]
    if (road === inEdge || road === outEdge) continue
    if (edgeOneway[road] === OneWay.Yes) return false
    // Headings leaving the node: along the road, back along the carriageway coming in, along the one going out.
    const away = (heading: number) => (heading + HEADING_STEPS / 2) % HEADING_STEPS
    const roadOut = edgeFrom[road] === node ? edgeHeading[road * 2] : away(edgeHeading[road * 2 + 1])
    return headingDifferenceDeg(roadOut, away(edgeHeading[inEdge * 2 + 1])) >= SPLIT_END_ROAD_DEG && headingDifferenceDeg(roadOut, edgeHeading[outEdge * 2]) >= SPLIT_END_ROAD_DEG
  }
  return false
}

function headingDifferenceDeg(a: number, b: number): number {
  const change = (a - b + HEADING_STEPS) % HEADING_STEPS
  return (Math.min(change, HEADING_STEPS - change) * 360) / HEADING_STEPS
}

/** Whether every edge of a ride from `start` is ridden the way it may be, with no banned U-turn. */
export function isRideable(graph: Graph, start: number, edges: number[]): boolean {
  let node = start
  for (const [index, edge] of edges.entries()) {
    if (!canRide(graph, edge, node) || (index > 0 && isUTurn(graph, edges[index - 1], node, edge))) return false
    node = otherEnd(graph, edge, node)
  }
  return true
}
