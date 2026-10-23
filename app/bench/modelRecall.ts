import { haversineM, type LonLat, pointAlong } from '../src/lib/geo'
import type { Twisty } from '../src/lib/data/twisties'
import type { EdgeWeights } from '../src/lib/routing/edgeWeights'
import type { NodeLocator } from '../src/lib/routing/nodeLocator'
import type { ShortestPaths } from '../src/lib/routing/shortestPaths'
import { detourCosts } from './greatRoads'
import { isRidden, type LocatedRoad, type PolylineIndex } from './roads'

/** G6: roads of the overlay rated at least this are the model's own idea of a great road. */
export const MODEL_RECALL_MIN_RATING = 4
/** A model road is missed when it costs at most this much to ride and no stop rides it. */
export const MODEL_RECALL_MAX_COST_S = 30 * 60
const LOWER_BOUND_KMH = 115
const MISSED_LISTED = 5

export interface MissedTwisty {
  id: number
  label: string
  rating: number
  lengthM: number
  costS: number
}

interface Candidate {
  twisty: Twisty
  road: LocatedRoad
}

export interface RecallTools {
  locator: NodeLocator
  searches: { fromStart: ShortestPaths; fromEnd: ShortestPaths }
  weights: EdgeWeights
}

export const twistyLabel = (twisty: Twisty): string => [twisty.ref, twisty.name].filter(Boolean).join(' · ') || `unnamed #${twisty.id}`

/** The overlay's well-rated twisties that a trip could have ridden within 30 minutes of detour, and no stop does. */
export class ModelRecall {
  private readonly rated: Twisty[]
  private readonly known = new Map<number, Candidate | null>()

  constructor(
    twisties: Twisty[],
    private readonly tools: RecallTools,
  ) {
    this.rated = twisties.filter((twisty) => twisty.rating >= MODEL_RECALL_MIN_RATING)
  }

  missed(trip: { from: LonLat; to: LonLat; includeTracks: boolean }, start: number, end: number, stops: PolylineIndex[]): MissedTwisty[] {
    const near = this.rated.filter((twisty) => {
      const middle = pointAlong(twisty.line, twisty.lengthM / 2)
      const extraM = haversineM(trip.from, middle) + haversineM(middle, trip.to) - haversineM(trip.from, trip.to)
      return extraM / 1000 / LOWER_BOUND_KMH <= MODEL_RECALL_MAX_COST_S / 3600
    })
    const candidates = near.flatMap((twisty) => this.candidate(twisty) ?? [])
    const costs = detourCosts(this.tools.searches, this.tools.weights, { start, end, includeTracks: trip.includeTracks }, candidates.map(({ road }) => road))
    return candidates
      .filter(({ road }) => (costs.get(road.id) ?? Infinity) <= MODEL_RECALL_MAX_COST_S)
      .filter(({ twisty }) => !stops.some((index) => isRidden(index, twisty.line)))
      .map(({ twisty, road }) => ({ id: twisty.id, label: twistyLabel(twisty), rating: twisty.rating, lengthM: twisty.lengthM, costS: costs.get(road.id) as number }))
      .sort((a, b) => b.rating - a.rating || b.lengthM - a.lengthM)
      .slice(0, MISSED_LISTED)
  }

  /** Where a twisty starts and ends in the graph and how long the fastest road between them takes (worked out once). */
  private candidate(twisty: Twisty): Candidate | null {
    if (!this.known.has(twisty.id)) this.known.set(twisty.id, this.locate(twisty))
    return this.known.get(twisty.id) ?? null
  }

  private locate(twisty: Twisty): Candidate | null {
    const { locator, searches, weights } = this.tools
    const [startNode, endNode] = [locator.nearest(twisty.line[0]), locator.nearest(twisty.line[twisty.line.length - 1])]
    if (startNode < 0 || endNode < 0 || startNode === endNode) return null
    searches.fromStart.search(startNode, { targets: [endNode], weights: weights.use(0, false) })
    const timeS = searches.fromStart.costTo(endNode)
    if (!Number.isFinite(timeS)) return null
    const road: LocatedRoad = { id: String(twisty.id), edges: [], line: twisty.line, lengthM: twisty.lengthM, timeS, startNode, endNode, deadEnd: false }
    return { twisty, road }
  }
}

