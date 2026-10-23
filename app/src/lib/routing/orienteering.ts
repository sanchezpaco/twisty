/**
 * Chains of twisty roads from A to B (plans/2026-10-16-orienteering-planner.md, problem 1): for every budget, the chain
 * of roads of most fun that fits it. A chain is A -> road -> road -> ... -> B, each road ridden in one direction at most
 * once, joined by legs. The solver works on estimates (the legs' table times and fun); the planner rebuilds the chains it
 * keeps as edges and measures them before any becomes a stop.
 */

/** One road of the pool, in one direction it may be ridden. */
export interface PoolRoad {
  /** The candidate it is a direction of: a chain rides each candidate once at most. */
  road: number
  rideS: number
  funM: number
  /** From A to its entry, and from its exit to B. */
  approachS: number
  departureS: number
}

export interface Leg {
  timeS: number
  funM: number
}

export interface ChainSettings {
  /** The fastest ride's time: the chain with no road. */
  fastestS: number
  /** The slider's range: the largest budget. */
  rangeS: number
  /** Budgets are swept every this many seconds up to the range. */
  stepS: number
  /** The most passes of local search per budget. */
  maxPasses: number
}

export interface Chain {
  /** Indices into the pool, in riding order. */
  roads: number[]
  timeS: number
  funM: number
}

/** The end of a chain on either side: A before the first road, B after the last. */
const END = -1

interface Problem {
  pool: PoolRoad[]
  /** For each pool road, the legs from its exit to the entries of the others, by pool road; and the reverse. */
  out: Map<number, Leg>[]
  into: Map<number, Leg>[]
  fastestS: number
}

/**
 * The chains met while sweeping the budgets that no other one beats on both time and fun, fastest first; the empty
 * chain (the fastest ride) is not among them. `out[a]` holds the legs from the exit of pool road a to the entries of
 * the others it can be chained to, by pool road.
 */
export function chainsOfRoads(pool: PoolRoad[], out: Map<number, Leg>[], settings: ChainSettings): Chain[] {
  const into = pool.map(() => new Map<number, Leg>())
  out.forEach((legs, from) => legs.forEach((leg, to) => into[to].set(from, leg)))
  const problem = { pool, out, into, fastestS: settings.fastestS }
  const archive: Chain[] = []
  let chain: number[] = []
  for (let budgetS = settings.stepS; budgetS <= settings.rangeS; budgetS += settings.stepS) {
    const latestS = settings.fastestS + budgetS
    chain = improved(problem, insertAll(problem, fitting(problem, chain, latestS), latestS), latestS, settings.maxPasses)
    if (chain.length > 0) archive.push(measure(problem, chain))
  }
  return frontierOf(archive)
}

/** Time and fun of a link of the chain: A to B (the fastest ride), A to a road, a road to B, or a leg. */
function link({ pool, out, fastestS }: Problem, from: number, to: number): Leg {
  if (from === END) return to === END ? { timeS: fastestS, funM: 0 } : { timeS: pool[to].approachS, funM: 0 }
  if (to === END) return { timeS: pool[from].departureS, funM: 0 }
  return out[from].get(to) ?? { timeS: Infinity, funM: 0 }
}

/** The pool roads that can go between `before` and `after` (either may be an end): only those with a leg on each side. */
function fitsBetween({ pool, out, into }: Problem, before: number, after: number): Iterable<number> {
  if (before === END) return after === END ? pool.keys() : into[after].keys()
  if (after === END) return out[before].keys()
  return [...out[before].keys()].filter((road) => out[road].has(after))
}

function measure(problem: Problem, roads: number[]): Chain {
  let timeS = 0
  let funM = 0
  for (let i = 0; i <= roads.length; i++) {
    const between = link(problem, i === 0 ? END : roads[i - 1], i === roads.length ? END : roads[i])
    timeS += between.timeS
    funM += between.funM
    if (i < roads.length) {
      timeS += problem.pool[roads[i]].rideS
      funM += problem.pool[roads[i]].funM
    }
  }
  return { roads, timeS, funM }
}

/** What inserting pool road `road` before position `position` adds to the chain's time and fun. */
function insertion(problem: Problem, chain: number[], road: number, position: number): Leg {
  const [before, after] = [position === 0 ? END : chain[position - 1], position === chain.length ? END : chain[position]]
  const [into, outOf, skipped] = [link(problem, before, road), link(problem, road, after), link(problem, before, after)]
  return {
    timeS: into.timeS + problem.pool[road].rideS + outOf.timeS - skipped.timeS,
    funM: into.funM + problem.pool[road].funM + outOf.funM - skipped.funM,
  }
}

/** Whether the road at `index` can be taken out: its neighbours (or the ends) must have a leg between them. */
function removable(problem: Problem, chain: number[], index: number): boolean {
  return Number.isFinite(link(problem, index === 0 ? END : chain[index - 1], index === chain.length - 1 ? END : chain[index + 1]).timeS)
}

/** Inserts roads while one fits, the one that adds the most fun per second it adds first. */
function insertAll(problem: Problem, start: number[], latestS: number): number[] {
  const chain = [...start]
  let { timeS } = measure(problem, chain)
  if (!Number.isFinite(timeS)) return chain
  for (;;) {
    const used = new Set(chain.map((road) => problem.pool[road].road))
    let best: { road: number; position: number; addedS: number; rate: number } | null = null
    for (let position = 0; position <= chain.length; position++) {
      for (const index of fitsBetween(problem, position === 0 ? END : chain[position - 1], position === chain.length ? END : chain[position])) {
        if (used.has(problem.pool[index].road)) continue
        const added = insertion(problem, chain, index, position)
        if (added.funM <= 0 || timeS + added.timeS > latestS) continue
        const rate = added.funM / Math.max(1, added.timeS)
        if (!best || rate > best.rate) best = { road: index, position, addedS: added.timeS, rate }
      }
    }
    if (!best) return chain
    const { road, position, addedS } = best
    chain.splice(position, 0, road)
    timeS += addedS
  }
}

/** The chain without the roads that give least fun per second until it fits a smaller budget than it was built for. */
function fitting(problem: Problem, chain: number[], latestS: number): number[] {
  const kept = [...chain]
  while (kept.length > 0 && measure(problem, kept).timeS > latestS) {
    const rates = kept.map((road, i) => {
      if (!removable(problem, kept, i)) return Infinity
      const saved = insertion(problem, kept.filter((_, j) => j !== i), road, i)
      return saved.funM / Math.max(1, saved.timeS)
    })
    kept.splice(rates.indexOf(Math.min(...rates)), 1)
  }
  return kept
}

/**
 * Local search while it adds fun within the budget: each road taken out and the chain filled again, and each road swapped
 * for another one (the other direction of it too), whose fun per second may be lower but whose fun is more.
 */
function improved(problem: Problem, start: number[], latestS: number, maxPasses: number): number[] {
  let chain = start
  let { funM } = measure(problem, chain)
  const keepIfBetter = (candidate: number[]) => {
    const measured = measure(problem, candidate)
    if (measured.timeS > latestS || measured.funM <= funM) return false
    chain = candidate
    funM = measured.funM
    return true
  }
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false
    for (let i = 0; i < chain.length; i++) {
      if (removable(problem, chain, i)) changed = keepIfBetter(insertAll(problem, chain.filter((_, j) => j !== i), latestS)) || changed
    }
    for (let i = 0; i < chain.length; i++) {
      const others = new Set(chain.filter((_, j) => j !== i).map((road) => problem.pool[road].road))
      for (const index of fitsBetween(problem, i === 0 ? END : chain[i - 1], i === chain.length - 1 ? END : chain[i + 1])) {
        if (index === chain[i] || others.has(problem.pool[index].road)) continue
        changed = keepIfBetter(chain.map((current, j) => (j === i ? index : current))) || changed
      }
    }
    if (!changed) break
    chain = insertAll(problem, chain, latestS)
    funM = measure(problem, chain).funM
  }
  return chain
}

function frontierOf(chains: Chain[]): Chain[] {
  const sorted = [...chains].filter((chain) => Number.isFinite(chain.timeS)).sort((a, b) => a.timeS - b.timeS || b.funM - a.funM)
  const kept: Chain[] = []
  for (const chain of sorted) if (kept.length === 0 || chain.funM > kept[kept.length - 1].funM) kept.push(chain)
  return kept
}
