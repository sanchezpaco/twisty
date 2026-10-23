import { edgeCoordinates, type Graph, nodePosition, OneWay, otherEnd, RoadClass, U_TURN_DEG } from '../src/lib/data/graph'
import { haversineM, type LonLat } from '../src/lib/geo'
import { twistyStretches } from '../src/lib/routing/ride'
import { isCurvyEdge, SHARP_TURN_DEG } from './checks'
import { resample } from './roads'

/** Speed at or below which a stretch with no fun is a town or a dull lane. */
const SLOW_KMH = 50
const REGRESS_STEP_M = 200
const PLACE_CELL_DEGREES = 0.03
const SUSPICIOUS_NAME = /\b(camí|camino|pista|forestal|senda|vereda|cañada)\b/i
// A heading at a node is read this far along the edge, so that the last few metres of a drawn edge do not decide it.
const HEADING_SPAN_M = 15
// A waypoint this close to a stretch is on it.
const WAYPOINT_ON_LINE_M = 10

/** R1: metres of the ride that repeat an edge already ridden (an edge used k times counts k - 1 times). */
export function backtrackM(graph: Graph, edges: number[]): number {
  const seen = new Set<number>()
  let repeated = 0
  for (const edge of edges) {
    if (seen.has(edge)) repeated += graph.edgeLengthM[edge]
    seen.add(edge)
  }
  return repeated
}

/** R2: nodes the walk goes through more than once. */
export function revisitedNodes(graph: Graph, edges: number[], start: number): number {
  const visits = new Map<number, number>([[start, 1]])
  let node = start
  for (const edge of edges) {
    node = otherEnd(graph, edge, node)
    visits.set(node, (visits.get(node) ?? 0) + 1)
  }
  return [...visits.values()].filter((count) => count > 1).length
}

/** R6: metres of road without fun at 50 km/h or less: towns, and lanes that are dull and slow. Slip roads and tracks do not count. */
export function slowDullM(graph: Graph, edges: number[]): number {
  return edges
    .filter((edge) => graph.edgeClass[edge] !== RoadClass.Track && graph.edgeClass[edge] !== RoadClass.Link)
    .filter((edge) => graph.edgeFunM[edge] === 0 && (graph.edgeLengthM[edge] / graph.edgeTimeS[edge]) * 3.6 <= SLOW_KMH)
    .reduce((sum, edge) => sum + graph.edgeLengthM[edge], 0)
}

/** R10: metres of tarmac whose name says it may be a track. */
export function suspiciousM(graph: Graph, edges: number[]): number {
  return edges
    .filter((edge) => graph.edgeClass[edge] !== RoadClass.Track && SUSPICIOUS_NAME.test(graph.roadNames[graph.edgeRoad[edge]]))
    .reduce((sum, edge) => sum + graph.edgeLengthM[edge], 0)
}

/** R14: the longest run of edges that are not curvy inside a twisty as the app draws and counts it. */
export function straightInTwistyM(graph: Graph, edges: number[]): number {
  let longest = 0
  for (const [first, last] of twistyStretches(graph, edges)) {
    let dullM = 0
    for (const edge of edges.slice(first, last + 1)) {
      dullM = isCurvyEdge(graph, edge) ? 0 : dullM + graph.edgeLengthM[edge]
      longest = Math.max(longest, dullM)
    }
  }
  return longest
}

/** R18: turns from one road onto another of at least `SHARP_TURN_DEG`, where the ride doubles back on itself. */
export function sharpTurns(graph: Graph, edges: number[], start: number): number {
  return turnAngles(graph, edges, start).filter((turn, i) => turn >= SHARP_TURN_DEG && graph.edgeRoad[edges[i]] !== graph.edgeRoad[edges[i + 1]]).length
}

/** H14: U-turns of at least `U_TURN_DEG` from one one-way edge onto another, measured on the drawn line (the planner bans them by the edges' headings). */
export function carriagewayUTurns(graph: Graph, edges: number[], start: number): number {
  const oneWay = (edge: number) => graph.edgeOneway[edge] === OneWay.Yes
  return turnAngles(graph, edges, start).filter((turn, i) => turn >= U_TURN_DEG && oneWay(edges[i]) && oneWay(edges[i + 1])).length
}

/** The turn at each node between consecutive edges, in degrees: 0 is straight on, 180 a U-turn. */
function turnAngles(graph: Graph, edges: number[], start: number): number[] {
  let node = start
  const lines = edges.map((edge) => {
    const from = node
    node = otherEnd(graph, edge, node)
    return [...edgeCoordinates(graph, edge, from), nodePosition(graph, node)]
  })
  return lines.slice(1).map((line, i) => {
    const inbound = lines[i]
    return Math.abs(((bearing(line[0], pointFrom(line)) - bearing(pointFrom(inbound.toReversed()), inbound.at(-1)!) + 540) % 360) - 180)
  })
}

/** R19: metres of a town's one-way streets ridden against their direction, and the Google Maps waypoints on them (R20). */
export function townWrongWay(graph: Graph, edges: number[], start: number, waypoints: LonLat[]): { metres: number; waypoints: number } {
  let [node, metres] = [start, 0]
  const lines: LonLat[][] = []
  for (const edge of edges) {
    const from = node
    node = otherEnd(graph, edge, node)
    if (graph.edgeOneway[edge] === OneWay.InTown && graph.edgeFrom[edge] !== from) {
      metres += graph.edgeLengthM[edge]
      lines.push([...edgeCoordinates(graph, edge, from), nodePosition(graph, node)])
    }
  }
  const onLine = (point: LonLat) => lines.some((line) => line.some((vertex, i) => i > 0 && distanceToSegmentM(point, line[i - 1], vertex) <= WAYPOINT_ON_LINE_M))
  return { metres, waypoints: waypoints.filter(onLine).length }
}

function distanceToSegmentM(point: LonLat, a: LonLat, b: LonLat): number {
  const k = Math.cos((point[1] * Math.PI) / 180)
  const [ax, ay, bx, by, px, py] = [a[0] * k, a[1], b[0] * k, b[1], point[0] * k, point[1]]
  const length2 = (bx - ax) ** 2 + (by - ay) ** 2
  const s = length2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / length2)) : 0
  return haversineM(point, [(ax + s * (bx - ax)) / k, ay + s * (by - ay)])
}

/** The first point of the line at least `HEADING_SPAN_M` from its start, or its end. */
function pointFrom(line: LonLat[]): LonLat {
  return line.find((point) => haversineM(line[0], point) >= HEADING_SPAN_M) ?? line[line.length - 1]
}

/** Heading from `a` to `b` in degrees, on a local flat map. */
function bearing([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  return (Math.atan2(lat2 - lat1, (lon2 - lon1) * Math.cos((lat1 * Math.PI) / 180)) * 180) / Math.PI
}

/** The ride as one line, from the edges. */
export function rideLine(graph: Graph, edges: number[], start: number): LonLat[] {
  const line: LonLat[] = [nodePosition(graph, start)]
  let node = start
  for (const edge of edges) {
    const next = otherEnd(graph, edge, node)
    const from = graph.edgeFrom[edge] === node
    const first = graph.edgeGeometryOffset[edge]
    const last = graph.edgeGeometryOffset[edge + 1]
    const inner: LonLat[] = []
    for (let i = first; i < last; i++) inner.push([graph.geometryLonLat[i * 2], graph.geometryLonLat[i * 2 + 1]])
    line.push(...(from ? inner : inner.reverse()), nodePosition(graph, next))
    node = next
  }
  return line
}

/** R12: metres ridden while the straight-line distance to the destination grows, sampling the line every 200 m. */
export function regressM(line: LonLat[], destination: LonLat): number {
  const samples = resample(line, REGRESS_STEP_M)
  let regress = 0
  for (let i = 1; i < samples.length; i++) {
    if (haversineM(samples[i], destination) > haversineM(samples[i - 1], destination)) regress += haversineM(samples[i - 1], samples[i])
  }
  return regress
}

/** R6b: the towns, villages and cities lying within a distance of a line, found through a grid of the places. */
export class PlaceIndex {
  private readonly cells = new Map<string, number[]>()

  constructor(private readonly places: LonLat[]) {
    places.forEach(([lon, lat], index) => {
      const key = this.key(lon, lat)
      this.cells.set(key, [...(this.cells.get(key) ?? []), index])
    })
  }

  /** Indexes of the places within `radiusM` of the line (of a point of it sampled every half radius). */
  near(line: LonLat[], radiusM: number): Set<number> {
    const found = new Set<number>()
    const reach = Math.ceil(radiusM / 111_000 / PLACE_CELL_DEGREES)
    for (const [lon, lat] of resample(line, radiusM / 2)) {
      const [cx, cy] = [Math.floor(lon / PLACE_CELL_DEGREES), Math.floor(lat / PLACE_CELL_DEGREES)]
      for (let x = cx - reach; x <= cx + reach; x++) {
        for (let y = cy - reach; y <= cy + reach; y++) {
          for (const index of this.cells.get(`${x}:${y}`) ?? []) {
            if (haversineM([lon, lat], this.places[index]) <= radiusM) found.add(index)
          }
        }
      }
    }
    return found
  }

  private key(lon: number, lat: number): string {
    return `${Math.floor(lon / PLACE_CELL_DEGREES)}:${Math.floor(lat / PLACE_CELL_DEGREES)}`
  }
}
