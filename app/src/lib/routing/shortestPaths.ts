import { type Graph, isUTurn, Ride } from '../data/graph'
import type { EdgeWeights } from './edgeWeights'
import { MinHeap } from './heap'

export interface SearchOptions {
  weights: EdgeWeights
  /** Stop as soon as all of these nodes are settled; with no targets at all the search covers the whole graph. */
  targets?: Iterable<number>
  /** Nodes also settled while the search is within `optionalLimit` of the source, but never waited for beyond it. */
  optionalTargets?: Iterable<number>
  optionalLimit?: number
}

/**
 * Forward: costs from the source, riding each edge the way it may be ridden. Backward: costs to the source, so one-way
 * edges are walked against their direction.
 */
export type SearchDirection = 'forward' | 'backward'

/**
 * Where the search keeps one label per edge it arrives by: the nodes with a banned U-turn (see `isUTurn`). Anywhere else
 * a node has one label, but there the way a ride came decides where it may go on, so the best way in by one edge must not
 * hide a dearer one by another. `slotStart[node]` is where the node's labels begin after the plain ones, or -1.
 *
 * `bans` hold, by label after the plain ones, the adjacency positions of the node the search may not go on by from that
 * label, as bits: forward the edges a ride may not leave by after coming in by the label's edge, backward the edges it
 * may not come in by before leaving by it. Testing a bit replaced scattered reads of headings and ends in the hot loop.
 */
interface TurnLabels {
  slotStart: Int32Array
  count: number
  bans: Record<SearchDirection, Uint32Array>
}

// A ban mask has one bit per adjacency position.
const MAX_TURN_NODE_DEGREE = 32

const turnLabelsOf = new WeakMap<Graph, TurnLabels>()

function turnLabels(graph: Graph): TurnLabels {
  let labels = turnLabelsOf.get(graph)
  if (!labels) {
    const { adjacencyStart, adjacencyEdge, adjacencyRide } = graph
    const slotStart = new Int32Array(graph.nodeCount).fill(-1)
    let count = graph.nodeCount
    // Only a one-way edge into the node, ridden on by one out of it, can make a U-turn; the other pairs are not tested.
    for (let node = 0; node < graph.nodeCount; node++) {
      let banned = false
      for (let i = adjacencyStart[node]; i < adjacencyStart[node + 1] && !banned; i++) {
        if (adjacencyRide[i] !== Ride.In) continue
        for (let j = adjacencyStart[node]; j < adjacencyStart[node + 1] && !banned; j++) banned = adjacencyRide[j] === Ride.Out && isUTurn(graph, adjacencyEdge[i], node, adjacencyEdge[j])
      }
      if (!banned) continue
      const degree = adjacencyStart[node + 1] - adjacencyStart[node]
      if (degree > MAX_TURN_NODE_DEGREE) throw new Error(`Node ${node} has a banned U-turn among ${degree} edges`)
      slotStart[node] = count
      count += degree
    }
    const forward = new Uint32Array(count - graph.nodeCount)
    const backward = new Uint32Array(count - graph.nodeCount)
    for (let node = 0; node < graph.nodeCount; node++) {
      if (slotStart[node] < 0) continue
      const first = adjacencyStart[node]
      const degree = adjacencyStart[node + 1] - first
      for (let a = 0; a < degree; a++) {
        const label = slotStart[node] + a - graph.nodeCount
        for (let k = 0; k < degree; k++) {
          if (isUTurn(graph, adjacencyEdge[first + a], node, adjacencyEdge[first + k])) forward[label] |= 1 << k
          if (isUTurn(graph, adjacencyEdge[first + k], node, adjacencyEdge[first + a])) backward[label] |= 1 << k
        }
      }
    }
    labels = { slotStart, count, bans: { forward, backward } }
    turnLabelsOf.set(graph, labels)
  }
  return labels
}

/**
 * Dijkstra over the graph in one direction. Buffers are allocated once and reset lazily,
 * so the same instance can run many searches cheaply.
 *
 * The search settles labels: a node's own, and at a node with a banned U-turn one per edge it can be reached by.
 */
export class ShortestPaths {
  private readonly turns: TurnLabels
  private readonly nodeOf: Int32Array
  private readonly cost: Float64Array
  private readonly viaEdge: Int32Array
  private readonly parent: Int32Array
  private readonly settled: Uint8Array
  private readonly nodeSettled: Uint8Array
  private readonly isTarget: Uint8Array
  private readonly heap = new MinHeap()
  private readonly touched: Uint32Array
  private touchedCount = 0
  source = -1
  private settledBefore = 0
  /** Nodes the current search has settled a label of. */
  private settledNodeCount = 0

  constructor(
    readonly graph: Graph,
    readonly direction: SearchDirection = 'forward',
  ) {
    this.turns = turnLabels(graph)
    const labels = this.turns.count
    this.nodeOf = new Int32Array(labels)
    for (let node = 0; node < graph.nodeCount; node++) {
      this.nodeOf[node] = node
      if (this.turns.slotStart[node] < 0) continue
      for (let k = 0; k < graph.adjacencyStart[node + 1] - graph.adjacencyStart[node]; k++) this.nodeOf[this.turns.slotStart[node] + k] = node
    }
    this.cost = new Float64Array(labels).fill(Infinity)
    this.viaEdge = new Int32Array(labels).fill(-1)
    this.parent = new Int32Array(labels).fill(-1)
    this.settled = new Uint8Array(labels)
    this.nodeSettled = new Uint8Array(graph.nodeCount)
    this.isTarget = new Uint8Array(graph.nodeCount)
    this.touched = new Uint32Array(labels)
  }

  search(source: number, { weights, targets, optionalTargets, optionalLimit = Infinity }: SearchOptions): void {
    this.start(source)
    const required = targets ? [...new Set(targets)] : []
    const optional = optionalTargets ? [...new Set(optionalTargets)].filter((node) => !required.includes(node)) : []
    for (const target of required) this.isTarget[target] = 1
    for (const target of optional) this.isTarget[target] = 2
    // With no target of either kind the search is exhaustive; with only optional ones it ends at the limit.
    let requiredLeft = targets || optionalTargets ? required.length : Infinity
    let optionalLeft = optional.length
    while (requiredLeft > 0 || (optionalLeft > 0 && this.nextKey() <= optionalLimit)) {
      if (this.nextKey() === Infinity) break
      const before = this.settledNodeCount
      const node = this.settleNext(weights)
      if (this.settledNodeCount === before) continue
      const kind = this.isTarget[node]
      if (kind === 1) requiredLeft--
      else if (kind === 2) optionalLeft--
    }
    for (const target of [...required, ...optional]) this.isTarget[target] = 0
  }

  /** Begins a search that is then advanced one node at a time with `settleNext`. */
  start(source: number): void {
    this.reset()
    this.source = source
    this.reach(source, 0, -1, -1)
  }

  /** Key of the next label to settle, or Infinity when the search has nothing left to explore. */
  nextKey(): number {
    while (this.heap.size > 0 && this.settled[this.heap.peekNode()]) this.heap.pop()
    return this.heap.size > 0 ? this.heap.peekKey() : Infinity
  }

  /**
   * Settles the nearest unsettled label and relaxes its node's edges, reporting each node reached at a better cost by an
   * edge (with the edge); returns the node. Only valid when `nextKey` is finite.
   */
  settleNext(weights: EdgeWeights, onReach?: (node: number, cost: number, edge: number) => void): number {
    const { adjacencyStart, adjacencyEdge, adjacencyNode, adjacencyRide, nodeCount } = this.graph
    // Forward a ride leaves this node by the edge; backward it comes into it.
    const ride = this.direction === 'backward' ? Ride.In : Ride.Out
    const key = this.heap.peekKey()
    const label = this.heap.pop()
    const node = this.nodeOf[label]
    this.settled[label] = 1
    if (!this.nodeSettled[node]) this.settledNodeCount++
    this.nodeSettled[node] = 1
    // Never a U-turn from the one-way edge the search came by: only a label of a node with one has bans.
    const banned = label < nodeCount ? 0 : this.turns.bans[this.direction][label - nodeCount]
    const first = adjacencyStart[node]
    for (let i = first; i < adjacencyStart[node + 1]; i++) {
      if (!(adjacencyRide[i] & ride) || banned & (1 << (i - first))) continue
      const neighbour = adjacencyNode[i]
      const edge = adjacencyEdge[i]
      const cost = key + weights.of(edge)
      const next = this.labelOf(neighbour, edge)
      if (cost < this.cost[next]) {
        this.reach(next, cost, edge, label)
        onReach?.(neighbour, cost, edge)
      }
    }
    return node
  }

  /** Nodes settled by every search since the instance was made: what a plan cost, whatever the machine. */
  get settledCount(): number {
    return this.settledBefore + this.settledNodeCount
  }

  /** Cost from the source, or Infinity if the node was not settled by the last search. */
  costTo(node: number): number {
    return this.nodeSettled[node] ? this.labelCost(this.bestLabel(node, true)) : Infinity
  }

  /** Best cost found so far, which is final only once the node is settled; Infinity if never reached. */
  reachedCost(node: number): number {
    return this.labelCost(this.bestLabel(node, false))
  }

  /**
   * The cheapest label found so far at `node` that the other search's `otherEdge` meets without a U-turn (see
   * `bidirectionalEdges`), or -1. Forward labels come into the node, backward ones go out of it.
   */
  meetingLabel(node: number, otherEdge: number): number {
    const slot = this.turns.slotStart[node]
    if (slot < 0) return this.cost[node] < Infinity ? node : -1
    let best = -1
    const last = slot + this.graph.adjacencyStart[node + 1] - this.graph.adjacencyStart[node]
    for (let label = node; label < last; label = label === node ? slot : label + 1) {
      if (this.cost[label] === Infinity || (best >= 0 && this.cost[label] >= this.cost[best])) continue
      const banned = this.direction === 'forward' ? isUTurn(this.graph, this.viaEdge[label], node, otherEdge) : isUTurn(this.graph, otherEdge, node, this.viaEdge[label])
      if (!banned) best = label
    }
    return best
  }

  labelCost(label: number): number {
    return label < 0 ? Infinity : this.cost[label]
  }

  labelEdge(label: number): number {
    return this.viaEdge[label]
  }

  /**
   * Edges from the source to a reached `node`, in the order the search walked them: riding order forward, against it
   * backward. `lastEdge` picks the way into the node when the search kept more than one.
   */
  edgesTo(node: number, lastEdge?: number): number[] {
    const label = lastEdge === undefined ? this.bestLabel(node, false) : this.labelOf(node, lastEdge)
    if (label < 0 || this.cost[label] === Infinity) throw new Error(`Node ${node} was not reached`)
    const edges: number[] = []
    for (let current = label; this.parent[current] >= 0; current = this.parent[current]) edges.push(this.viaEdge[current])
    return edges.reverse()
  }

  /** The label of `node` when reached by `edge`: its own, or at a node with a banned U-turn the one of that edge. */
  private labelOf(node: number, edge: number): number {
    const slot = this.turns.slotStart[node]
    if (slot < 0 || edge < 0) return node
    const { adjacencyStart, adjacencyEdge } = this.graph
    for (let i = adjacencyStart[node]; i < adjacencyStart[node + 1]; i++) if (adjacencyEdge[i] === edge) return slot + i - adjacencyStart[node]
    return node
  }

  /** The node's cheapest label, settled or only reached; -1 for none. */
  private bestLabel(node: number, settledOnly: boolean): number {
    let best = -1
    const slot = this.turns.slotStart[node]
    const last = slot < 0 ? node + 1 : slot + this.graph.adjacencyStart[node + 1] - this.graph.adjacencyStart[node]
    for (let label = node; label < last; label = label === node && slot >= 0 ? slot : label + 1) {
      if ((!settledOnly || this.settled[label]) && this.cost[label] < (best < 0 ? Infinity : this.cost[best])) best = label
    }
    return best
  }

  private reach(label: number, cost: number, edge: number, parent: number): void {
    if (this.cost[label] === Infinity) this.touched[this.touchedCount++] = label
    this.cost[label] = cost
    this.viaEdge[label] = edge
    this.parent[label] = parent
    this.heap.push(label, cost)
  }

  private reset(): void {
    this.settledBefore = this.settledCount
    this.settledNodeCount = 0
    for (let i = 0; i < this.touchedCount; i++) {
      const label = this.touched[i]
      this.cost[label] = Infinity
      this.viaEdge[label] = -1
      this.parent[label] = -1
      this.settled[label] = 0
      this.nodeSettled[this.nodeOf[label]] = 0
    }
    this.touchedCount = 0
    this.heap.clear()
  }
}
