/**
 * The slider's stops, chosen as one set (plans/2026-10-16-orienteering-planner.md, section 1, problem 2). A rider takes
 * the best stop that fits their spare time, spread evenly over the slider's range; the stops maximise the fun they can
 * expect that way, plus the fun of every great road some stop rides, minus a price per stop:
 *
 *   U(S) = Σ v(s_i) · (t_{i+1} − t_i) / T  +  greatRoadWeight · Σ fun of the great roads ridden  −  stopWorth · (|S| − 1)
 *
 * with t the extra time of each stop and t_{|S|+1} = T. The stops climb a ladder: the fastest ride first, then each one
 * slower, with more fun and more twisty km than the one before.
 */

export interface LadderRide {
  timeS: number
  /** Fun-weighted metres: the value of the ride. */
  score: number
  /** Metres on highlighted twisties: what the rider compares between stops on screen. */
  twistyM: number
  /** Indices of the great roads (into `greatRoadFunM`) the ride rides. */
  greatRoads: number[]
}

export interface SliderSettings {
  /** The fastest ride's time: extra time is measured from it. */
  fastestS: number
  /** T, the slider's range of extra time. */
  rangeS: number
  maxStops: number
  /** Fun metres a stop must add to the objective to be shown. */
  stopWorth: number
  /** What a metre of fun on a great road some stop rides adds, on top of the stops' own value. */
  greatRoadWeight: number
  /** The fun of each great road, by index. */
  greatRoadFunM: number[]
}

export interface ChosenStops<R> {
  stops: R[]
  /** For each stop, the great road it was put on the slider for, or null when the ladder chose it alone. */
  addedFor: (number | null)[]
}

/**
 * The stops among `rides`, which must hold the fastest ride. Without great roads this is the ladder of most expected fun,
 * found exactly; each great road no stop rides is then added while the objective grows, by forcing through the slider
 * the ride of it that pays most.
 */
export function chooseStops<R extends LadderRide>(rides: R[], settings: SliderSettings): ChosenStops<R> {
  const items = [...rides]
    .filter((ride) => ride.timeS - settings.fastestS <= settings.rangeS)
    .sort((a, b) => a.timeS - b.timeS || b.score - a.score)
  if (items.length === 0) return { stops: [], addedFor: [] }
  const forced: number[] = []
  const addedFor = new Map<number, number>()
  let tables = ladderTables(items, forced, settings)
  let best = tables.through(0)
  let bestValue = objective(items, best, settings)
  for (;;) {
    const ridden = roadsOf(items, best)
    let improvement: { item: number; road: number; ladder: number[]; value: number } | null = null
    for (const item of ridesOfNewRoads(items, best, ridden)) {
      const newRoads = items[item].greatRoads.filter((road) => !ridden.has(road))
      const ladder = tables.through(item)
      if (ladder.length === 0) continue
      const value = objective(items, ladder, settings)
      if (value > bestValue && (!improvement || value > improvement.value)) {
        improvement = { item, road: newRoads.reduce((a, b) => (settings.greatRoadFunM[b] > settings.greatRoadFunM[a] ? b : a)), ladder, value }
      }
    }
    if (!improvement) break
    const { item, road, ladder, value } = improvement
    forced.push(item)
    forced.sort((a, b) => a - b)
    addedFor.set(item, road)
    tables = ladderTables(items, forced, settings)
    best = ladder
    bestValue = value
  }
  return { stops: best.map((item) => items[item]), addedFor: best.map((item) => addedFor.get(item) ?? null) }
}

/**
 * The rides worth forcing for the great roads no stop rides: for each such road, the rides of it that no other ride of
 * it beats on both time and fun. A dominated ride of a road can only give a worse ladder through it.
 */
function ridesOfNewRoads<R extends LadderRide>(items: R[], ladder: number[], ridden: Set<number>): Set<number> {
  const byRoad = new Map<number, number[]>()
  items.forEach((ride, item) => {
    if (ladder.includes(item)) return
    for (const road of ride.greatRoads) if (!ridden.has(road)) byRoad.set(road, [...(byRoad.get(road) ?? []), item])
  })
  const worth = new Set<number>()
  for (const rideItems of byRoad.values()) {
    let bestScore = -Infinity
    for (const item of rideItems) {
      if (items[item].score > bestScore) {
        worth.add(item)
        bestScore = items[item].score
      }
    }
  }
  return worth
}

/** U of the stops at these indices of `items`. */
function objective<R extends LadderRide>(items: R[], ladder: number[], settings: SliderSettings): number {
  const roads = roadsOf(items, ladder)
  let greatFunM = 0
  for (const road of roads) greatFunM += settings.greatRoadFunM[road]
  return expectedFun(items, ladder, settings) + settings.greatRoadWeight * greatFunM - settings.stopWorth * (ladder.length - 1)
}

function expectedFun<R extends LadderRide>(items: R[], ladder: number[], { fastestS, rangeS }: SliderSettings): number {
  return ladder.reduce((sum, item, i) => {
    const until = i + 1 < ladder.length ? items[ladder[i + 1]].timeS - fastestS : rangeS
    return sum + (items[item].score * (until - (items[item].timeS - fastestS))) / rangeS
  }, 0)
}

function roadsOf<R extends LadderRide>(items: R[], ladder: number[]): Set<number> {
  return new Set(ladder.flatMap((item) => items[item].greatRoads))
}

const climbs = (from: LadderRide, to: LadderRide) => to.timeS > from.timeS && to.score > from.score && to.twistyM > from.twistyM

/**
 * The ladders of most expected fun minus the stops' price that start at the first item (the fastest ride) and pass
 * through every item in `forced` (sorted indices), as a dynamic programme over the items by time on the number of stops:
 * from each item on to the end of the slider, and from the first item up to each one. `through(i)` is the best ladder
 * that also passes through item i, empty when there is none.
 */
function ladderTables<R extends LadderRide>(items: R[], forced: number[], settings: SliderSettings): { through: (item: number) => number[] } {
  const n = items.length
  const { maxStops, stopWorth, fastestS, rangeS } = settings
  const at = (item: number) => (items[item].timeS - fastestS) / rangeS
  // A ladder may not climb past a forced item: the first forced item after each index, and the last one before it.
  const nextForced = new Int32Array(n).fill(n)
  const previousForced = new Int32Array(n).fill(0)
  for (let i = n - 1, next = n; i >= 0; i--) {
    nextForced[i] = next
    if (forced.includes(i)) next = i
  }
  for (let i = 0, previous = 0; i < n; i++) {
    previousForced[i] = previous
    if (forced.includes(i)) previous = i
  }
  const table = () => Array.from({ length: maxStops + 1 }, () => new Float64Array(n).fill(-Infinity))
  const links = () => Array.from({ length: maxStops + 1 }, () => new Int32Array(n).fill(-1))
  // after[k][i]: the fun from item i to the end with k stops from i on, its own share included; next[k][i]: the stop after i.
  const [after, next] = [table(), links()]
  for (let i = n - 1; i >= 0; i--) {
    if (nextForced[i] === n) after[1][i] = items[i].score * (1 - at(i))
    for (let k = 2; k <= maxStops; k++) {
      for (let j = i + 1; j <= Math.min(nextForced[i], n - 1); j++) {
        if (after[k - 1][j] === -Infinity || !climbs(items[i], items[j])) continue
        const candidate = items[i].score * (at(j) - at(i)) + after[k - 1][j] - stopWorth
        if (candidate > after[k][i]) {
          after[k][i] = candidate
          next[k][i] = j
        }
      }
    }
  }
  // before[k][i]: the fun of the k stops from the first item up to i, i's own share left out; previous[k][i]: the stop before i.
  const [before, previous] = [table(), links()]
  before[1][0] = 0
  for (let i = 1; i < n; i++) {
    for (let k = 2; k <= maxStops; k++) {
      for (let h = previousForced[i]; h < i; h++) {
        if (before[k - 1][h] === -Infinity || !climbs(items[h], items[i])) continue
        const candidate = before[k - 1][h] + items[h].score * (at(i) - at(h)) - stopWorth
        if (candidate > before[k][i]) {
          before[k][i] = candidate
          previous[k][i] = h
        }
      }
    }
  }
  const through = (item: number): number[] => {
    let best = { value: -Infinity, upTo: 0, from: 0 }
    for (let upTo = 1; upTo <= maxStops; upTo++) {
      for (let from = 1; upTo + from - 1 <= maxStops; from++) {
        const value = before[upTo][item] + after[from][item]
        if (value > best.value) best = { value, upTo, from }
      }
    }
    if (best.value === -Infinity) return []
    const ladder = [item]
    for (let k = best.upTo, i = item; k > 1; k--) ladder.unshift((i = previous[k][i]))
    for (let k = best.from, i = item; k > 1; k--) ladder.push((i = next[k][i]))
    return ladder
  }
  return { through }
}
