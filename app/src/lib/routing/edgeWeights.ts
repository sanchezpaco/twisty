import { EdgeFlag, type Graph, RoadClass } from '../data/graph'

// A road open only to those with business there is no way through: in every search its minutes cost this many times
// more, so it is ridden where nothing else reaches (the last metres to a village whose only way in it is) and not as a
// short cut (Camino de Ronda a Setenil, rider-safety review 2026-10-19). The time a route reports stays the real one.
const DESTINATION_ONLY_COST = 4

/**
 * Curve appetite `k` discounts travel time on fun roads: a minute on a road with fun share `f` costs
 * `exp(-k * f)` minutes. 0 is the fastest route; at 6 the best roads feel hundreds of times shorter.
 * Motorways have no fun, keep their real cost, and are still used to get to the good roads quickly.
 *
 * Weights are worked out the first time a search looks at an edge. This only pays together with the bidirectional
 * search, which settles a quarter of the graph: with one-way searches (half of Spain each) the scattered reads made
 * lazy weights slower than one sequential pass over every edge.
 */
export class EdgeWeights {
  private readonly funShare: Float32Array
  private readonly costFactor: Float32Array
  // Single precision, so every weight is exactly what it was when all of them were stored up front.
  private readonly values: Float32Array
  private readonly workedOutIn: Uint32Array
  private generation = 0
  private appetite = 0
  private includeTracks = false

  constructor(private readonly graph: Graph) {
    this.funShare = graph.edgeFunM.map((fun, edge) => Math.min(1, fun / (graph.edgeLengthM[edge] || 1)))
    this.costFactor = Float32Array.from(graph.edgeFlags, (flags) => (flags & EdgeFlag.DestinationOnly ? DESTINATION_ONLY_COST : 1))
    this.values = new Float32Array(graph.edgeCount)
    this.workedOutIn = new Uint32Array(graph.edgeCount)
  }

  /** Switches every weight to this appetite; unpaved roads and tracks are closed unless the rider opts in. */
  use(appetite: number, includeTracks: boolean): this {
    this.generation++
    this.appetite = appetite
    this.includeTracks = includeTracks
    return this
  }

  of(edge: number): number {
    if (this.workedOutIn[edge] !== this.generation) {
      this.workedOutIn[edge] = this.generation
      const closed = !this.includeTracks && this.graph.edgeClass[edge] === RoadClass.Track
      this.values[edge] = closed ? Infinity : this.graph.edgeTimeS[edge] * this.costFactor[edge] * Math.exp(-this.appetite * this.funShare[edge])
    }
    return this.values[edge]
  }
}
