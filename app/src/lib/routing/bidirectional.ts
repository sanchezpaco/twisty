import type { EdgeWeights } from './edgeWeights'
import type { ShortestPaths } from './shortestPaths'

/**
 * Fastest edges from `source` to `target`, searching from both ends until the two frontiers meet: each side only
 * covers about half the distance, so far fewer nodes are settled than by one search all the way. `forward` searches
 * from the source, `backward` (a backward search) towards the target. Null when the target cannot be reached.
 */
export function bidirectionalEdges(
  forward: ShortestPaths,
  backward: ShortestPaths,
  source: number,
  target: number,
  weights: EdgeWeights,
): number[] | null {
  if (source === target) return []
  forward.start(source)
  backward.start(target)
  let best = { cost: Infinity, node: -1, forwardEdge: -1, backwardEdge: -1 }
  // A node both searches have reached joins a route from each end, unless the two halves meet in a U-turn; keep the
  // cheapest such node, and the edges the two halves come into it by.
  const forwardReached = (node: number, cost: number, edge: number) => {
    const other = backward.meetingLabel(node, edge)
    if (cost + backward.labelCost(other) < best.cost) best = { cost: cost + backward.labelCost(other), node, forwardEdge: edge, backwardEdge: backward.labelEdge(other) }
  }
  const backwardReached = (node: number, cost: number, edge: number) => {
    const other = forward.meetingLabel(node, edge)
    if (cost + forward.labelCost(other) < best.cost) best = { cost: cost + forward.labelCost(other), node, forwardEdge: forward.labelEdge(other), backwardEdge: edge }
  }
  // No cheaper meeting can appear once the two frontiers together are as costly as the best one; an exhausted
  // side has nothing left to meet.
  while (forward.nextKey() + backward.nextKey() < best.cost) {
    if (forward.nextKey() <= backward.nextKey()) forward.settleNext(weights, forwardReached)
    else backward.settleNext(weights, backwardReached)
  }
  if (best.node < 0) return null
  return [...forward.edgesTo(best.node, best.forwardEdge), ...backward.edgesTo(best.node, best.backwardEdge).reverse()]
}
