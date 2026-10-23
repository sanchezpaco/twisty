import { type Graph, parseGraph } from '../data/graph'
import type { LonLat } from '../geo'

export interface FixtureEdge {
  from: number
  to: number
  timeS: number
  lengthM?: number
  funM?: number
  road?: number
  roadClass?: number
  /** Share of the edge's length on narrow ways, 0..255. */
  narrow?: number
  /** Lowest limit posted on the edge when it is at most 40 km/h. */
  postedKmh?: number
  /** Ford nodes on the edge. */
  fords?: number
  /** `OneWay`; none is `OneWay.No`. */
  oneway?: number
  /** Riding from -> to, the heading leaving `from` and arriving at `to` in degrees anticlockwise from east; worked out from the geometry when left out. */
  headings?: [number, number]
  /** `EdgeFlag` bits. */
  flags?: number
  geometry?: LonLat[]
}

/** Serialises a small graph into the pipeline's binary format, so tests exercise the real parser. */
export function graphFixture(nodes: LonLat[], edges: FixtureEdge[], roadNames: string[] = ['']): Graph {
  return parseGraph(graphBuffer(nodes, edges, roadNames))
}

export function graphBuffer(nodes: LonLat[], edges: FixtureEdge[], roadNames: string[] = ['']): ArrayBuffer {
  const geometry = edges.flatMap((edge) => edge.geometry ?? [])
  const names = new TextEncoder().encode(JSON.stringify(roadNames))
  const words = 5 + nodes.length * 2 + edges.length * 6 + (edges.length + 1) + geometry.length * 2
  const buffer = new ArrayBuffer(words * 4 + edges.length * 8 + names.length)
  const view = new DataView(buffer)
  new Uint8Array(buffer).set(new TextEncoder().encode('TWG5'))
  let offset = 4
  const u32 = (value: number) => {
    view.setUint32(offset, value, true)
    offset += 4
  }
  const f32 = (value: number) => {
    view.setFloat32(offset, value, true)
    offset += 4
  }
  ;[nodes.length, edges.length, geometry.length, names.length].forEach(u32)
  nodes.forEach(([lon, lat]) => (f32(lon), f32(lat)))
  edges.forEach((edge) => u32(edge.from))
  edges.forEach((edge) => u32(edge.to))
  edges.forEach((edge) => f32(edge.timeS))
  edges.forEach((edge) => f32(edge.lengthM ?? edge.timeS * 10))
  edges.forEach((edge) => f32(edge.funM ?? 0))
  edges.forEach((edge) => u32(edge.road ?? 0))
  let points = 0
  u32(0)
  edges.forEach((edge) => u32((points += edge.geometry?.length ?? 0)))
  geometry.forEach(([lon, lat]) => (f32(lon), f32(lat)))
  edges.forEach((edge, i) => view.setUint8(offset + i, edge.roadClass ?? 3))
  edges.forEach((edge, i) => view.setUint8(offset + edges.length + i, edge.narrow ?? 0))
  edges.forEach((edge, i) => view.setUint8(offset + edges.length * 2 + i, edge.postedKmh ?? 0))
  edges.forEach((edge, i) => view.setUint8(offset + edges.length * 3 + i, edge.fords ?? 0))
  edges.forEach((edge, i) => view.setUint8(offset + edges.length * 4 + i, edge.oneway ?? 0))
  edges.forEach((edge, i) => {
    // A stacked layer's edges may end at nodes of the graph below, which this fixture does not have: no heading then.
    const line = [nodes[edge.from], ...(edge.geometry ?? []), nodes[edge.to]].filter((point) => point !== undefined)
    const [leaving, arriving] = edge.headings ?? (line.length < 2 ? [0, 0] : [heading(line[0], line[1]), heading(line[line.length - 2], line[line.length - 1])])
    view.setUint8(offset + edges.length * 5 + i * 2, steps(leaving))
    view.setUint8(offset + edges.length * 5 + i * 2 + 1, steps(arriving))
  })
  edges.forEach((edge, i) => view.setUint8(offset + edges.length * 7 + i, edge.flags ?? 0))
  new Uint8Array(buffer, offset + edges.length * 8).set(names)
  return buffer
}

const heading = ([lon1, lat1]: LonLat, [lon2, lat2]: LonLat) =>
  (Math.atan2(lat2 - lat1, (lon2 - lon1) * Math.cos((lat1 * Math.PI) / 180)) * 180) / Math.PI
const steps = (degrees: number) => Math.round((((degrees % 360) + 360) % 360) / (360 / 256)) % 256
