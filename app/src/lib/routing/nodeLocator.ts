import { type Graph, nodePosition, OneWay, RoadClass } from '../data/graph'
import { haversineM, type LonLat } from '../geo'

const CELL_DEGREES = 0.05
const MAX_SNAP_DISTANCE_M = 15_000
// Marks a node in the first pass; no real cell has this column.
const NOT_ENTERABLE = -(2 ** 31)

/**
 * Finds the nearest graph node a rider can actually start from: on a two-way road, not a motorway or ramp.
 * Never a track, so a town next to a forest track still starts on its street. Never a node of one-way streets only:
 * the graph lacks most town streets, so leaving one the legal way can mean a long loop round the town.
 *
 * Nodes are bucketed in a grid of cells laid out as a flat array: building it touches every node of the graph
 * at start-up, and a map keyed by strings made that the slowest step on a phone.
 */
export class NodeLocator {
  private readonly firstCellX: number
  private readonly firstCellY: number
  private readonly columns: number
  private readonly rows: number
  /** Nodes of cell c live at [cellStart[c], cellStart[c + 1]) of `cellNodes`, in node order. */
  private readonly cellStart: Uint32Array
  private readonly cellNodes: Uint32Array

  constructor(private readonly graph: Graph) {
    const { nodeCount, nodeLonLat } = graph
    // The cell of each node; the column of a node nobody can start from is NOT_ENTERABLE.
    const cellsX = new Int32Array(nodeCount)
    const cellsY = new Int32Array(nodeCount)
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity]
    let enterableCount = 0
    for (let node = 0; node < nodeCount; node++) {
      cellsX[node] = this.isEnterable(node) ? Math.floor(nodeLonLat[node * 2] / CELL_DEGREES) : NOT_ENTERABLE
      if (cellsX[node] === NOT_ENTERABLE) continue
      cellsY[node] = Math.floor(nodeLonLat[node * 2 + 1] / CELL_DEGREES)
      enterableCount++
      minX = Math.min(minX, cellsX[node])
      maxX = Math.max(maxX, cellsX[node])
      minY = Math.min(minY, cellsY[node])
      maxY = Math.max(maxY, cellsY[node])
    }
    this.firstCellX = minX
    this.firstCellY = minY
    this.columns = enterableCount > 0 ? maxX - minX + 1 : 0
    this.rows = enterableCount > 0 ? maxY - minY + 1 : 0
    this.cellStart = new Uint32Array(this.columns * this.rows + 1)
    for (let node = 0; node < nodeCount; node++) {
      if (cellsX[node] !== NOT_ENTERABLE) this.cellStart[this.cellIndex(cellsX[node], cellsY[node]) + 1]++
    }
    for (let cell = 0; cell < this.columns * this.rows; cell++) this.cellStart[cell + 1] += this.cellStart[cell]
    const cursor = this.cellStart.slice(0, -1)
    this.cellNodes = new Uint32Array(enterableCount)
    for (let node = 0; node < nodeCount; node++) {
      if (cellsX[node] !== NOT_ENTERABLE) this.cellNodes[cursor[this.cellIndex(cellsX[node], cellsY[node])]++] = node
    }
  }

  /** Nearest enterable node, or -1 if none is within reach. */
  nearest(point: LonLat): number {
    const [cx, cy] = this.cellOf(point)
    const maxRing = Math.ceil(MAX_SNAP_DISTANCE_M / 111_000 / CELL_DEGREES) + 1
    let best = -1
    let bestDistance = MAX_SNAP_DISTANCE_M
    const consider = (x: number, y: number) => {
      if (x < this.firstCellX || y < this.firstCellY || x >= this.firstCellX + this.columns || y >= this.firstCellY + this.rows) return
      const cell = this.cellIndex(x, y)
      for (let i = this.cellStart[cell]; i < this.cellStart[cell + 1]; i++) {
        const node = this.cellNodes[i]
        const distance = haversineM(point, nodePosition(this.graph, node))
        if (distance < bestDistance) {
          best = node
          bestDistance = distance
        }
      }
    }
    for (let ring = 0; ring <= maxRing; ring++) {
      for (let x = cx - ring; x <= cx + ring; x++) {
        for (let y = cy - ring; y <= cy + ring; y++) {
          if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) === ring) consider(x, y)
        }
      }
      // Anything in further rings is at least `ring` cells away.
      if (best >= 0 && ring * CELL_DEGREES * 111_000 * 0.5 > bestDistance) break
    }
    return best
  }

  private isEnterable(node: number): boolean {
    const { adjacencyStart, adjacencyEdge, edgeClass, edgeOneway } = this.graph
    for (let i = adjacencyStart[node]; i < adjacencyStart[node + 1]; i++) {
      const roadClass = edgeClass[adjacencyEdge[i]]
      const road = roadClass !== RoadClass.Motorway && roadClass !== RoadClass.Link && roadClass !== RoadClass.Track
      if (road && edgeOneway[adjacencyEdge[i]] !== OneWay.Yes) return true
    }
    return false
  }

  private cellOf([lon, lat]: LonLat): [number, number] {
    return [Math.floor(lon / CELL_DEGREES), Math.floor(lat / CELL_DEGREES)]
  }

  private cellIndex(x: number, y: number): number {
    return (y - this.firstCellY) * this.columns + (x - this.firstCellX)
  }
}
