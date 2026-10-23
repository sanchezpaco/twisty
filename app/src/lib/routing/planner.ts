import { EdgeFlag, type Graph, isRideable, nodePosition, otherEnd } from '../data/graph'
import { PlanningError } from '../errors'
import { haversineM, type LonLat, METRES_PER_DEGREE } from '../geo'
import { MAX_VIA } from '../googleMaps'
import { type Candidate, findCandidates } from './candidates'
import { bidirectionalEdges } from './bidirectional'
import { EdgeWeights } from './edgeWeights'
import { buildLegTable, type LegTable, legsOfEnd, slotOf } from './legs'
import { chainsOfRoads, type Leg, type PoolRoad } from './orienteering'
import { NodeLocator } from './nodeLocator'
import { paretoFrontier, paretoSum } from './pareto'
import { buildRideOption, type RideOption, ratingOf, twistyLengthM, twistyStretches } from './ride'
import { ShortestPaths } from './shortestPaths'
import { chooseStops, type LadderRide } from './slider'

export interface PlanSettings {
  /** Longest detour, on top of the fastest route, worth offering. */
  maxExtraS: number
  /** Unpaved roads and tracks are only ridden when the rider asks for them. */
  includeTracks: boolean
  /** The start is "My location": the exact position stays out of the Google Maps link. */
  startIsRider: boolean
}

export const DEFAULT_PLAN_SETTINGS: PlanSettings = { maxExtraS: 3 * 3600, includeTracks: false, startIsRider: false }

const FASTEST_APPETITE = 0
// Searched in addition to the fastest route (see EdgeWeights). The rides in between come from the chains of roads, which
// made the searches at the appetites in between add nothing a G1 or recall needed.
const APPETITES = [1, 2, 3, 4, 5, 6, 8]
// The slider (slider.ts): at most this many stops; the fun-weighted metres (see Graph.edgeFunM) a stop must add to be
// shown; and what a metre of fun on a great road some stop rides adds on top of the stops' own value. The two weights
// are fitted on the bench's tuning trips.
const MAX_STOPS = 9
const STOP_WORTH = 250
const GREAT_ROAD_WEIGHT = 0.06

// A ride passes a point when it is farther than PASS_AWAY_M from it, comes within PASS_NEAR_M, and goes farther than
// PASS_AWAY_M again: a leg that passes its end goes past where the rider is heading and comes back; one that passes its
// start loops back home before setting off (ROADMAP 16, plans/2026-10-19-via-quality.md).
const PASS_NEAR_M = 3_000
const PASS_AWAY_M = 8_000
// No road of the graph is driven faster, so the straight line at this speed is the least a leg can take.
const FASTEST_POSSIBLE_SPEED_MS = 130 / 3.6
// A detour to a twisty road is worth offering up to this long, on a trip of any length and whatever the rider's budget: a
// great road is not worth more. It decides the pool of roads a trip's rides are made of.
const GREAT_ROAD_MAX_EXTRA_S = 90 * 60
// A great road, which the slider makes room for, is rated this well, mostly out of towns, and rides on in a twisty this
// long: a 3 km village crossing rated 5 (A-6026 through Campillo de Arenas, Esterri's avinguda of the C-28) headed
// defaults the rider never knew (expert-rider, release review 2026-10-19). The length is the twisty's, as the rider sees
// it, not the candidate's: a candidate is a piece between junctions, and 63% of the rated ones are shorter than that.
const GREAT_RATING = 4
const GREAT_MAX_BUILT_UP_SHARE = 0.25
const GREAT_MIN_TWISTY_M = 8_000
// A road counts as ridden by a stop when the stop covers this much of its length.
const RIDDEN_SHARE = 0.8
// Chains of roads (orienteering.ts): the budgets are swept this often, with this many passes of local search each.
const CHAIN_STEP_S = 5 * 60
const CHAIN_PASSES = 2
// On a trip with stops, a leg's ride of a great road is joined to the other legs' best rides for budgets this far apart:
// every 5 minutes made the loop València -> Teruel -> Segorbe -> València 3,445 whole rides and twice the time of its legs
// planned one by one.
const JOIN_STEP_S = 20 * 60

/** One leg of the trip: a two-point trip from `start` to `end`. */
interface Trip {
  start: number
  end: number
  includeTracks: boolean
  /** Its index among the legs, for the rider's error. */
  leg: number
}

interface Stretch {
  appetite: number
  entry: number
  exit: number
  middle: number[]
  /** Set when the stretch is the whole of one candidate; a stretch of an appetite route has none. */
  road?: Candidate
}

interface Route {
  appetite: number
  edges: number[]
  timeS: number
  score: number
  /** The candidate this ride is of, when it is the ride of one road alone. */
  road?: Candidate
  /** The road a coverage stop was swapped in for. */
  addedRoad?: Candidate
  /** On a trip with stops, the index after each leg's last edge. */
  legEnds?: number[]
}

/** A whole ride as it is folded: one ride per leg so far, with their times and scores added. */
interface Joined {
  timeS: number
  score: number
  parts: Route[]
}

type SliderStop = Route & LadderRide

/** The ways from the start to each stretch's entry and from each stretch's exit to the end, and the pool they decide. */
interface Ways {
  pool: Stretch[]
  approach: Map<number, number[]>
  departure: Map<number, number[]>
}

export class Planner {
  private readonly locator: NodeLocator
  private readonly paths: ShortestPaths
  private readonly backwardPaths: ShortestPaths
  private readonly weights: EdgeWeights
  /** The great road each edge is on while the stops are chosen, -1 for none: kept between plans, it costs no allocation. */
  private readonly roadOfEdge: Int32Array

  /** `candidates` are the twisty roads of the graph, and `legs` the legs between their ends, when they were found beforehand (`make candidates`). */
  constructor(
    readonly graph: Graph,
    private candidates?: Candidate[],
    private legs?: LegTable,
  ) {
    this.locator = new NodeLocator(graph)
    this.paths = new ShortestPaths(graph)
    this.backwardPaths = new ShortestPaths(graph, 'backward')
    this.weights = new EdgeWeights(graph)
    this.roadOfEdge = new Int32Array(graph.edgeCount)
  }

  /** Nodes settled by every plan so far: the cost of planning, the same on every machine. */
  get settledNodes(): number {
    return this.paths.settledCount + this.backwardPaths.settledCount
  }

  /**
   * The options from the first point to the last through the others in order (plans/2026-10-18-via-points-planner.md):
   * each leg is planned as a trip of its own up to the slider, and the slider chooses among whole rides. `onFastest`
   * hears the fastest ride as soon as it is known, well before the rest of the options are.
   */
  plan(points: LonLat[], settings: Partial<PlanSettings> = {}, onFastest?: (option: RideOption) => void): RideOption[] {
    if (points.length < 2 || points.length > 2 + MAX_VIA) throw new Error(`A trip has 2 to ${2 + MAX_VIA} points, not ${points.length}`)
    const { maxExtraS, includeTracks, startIsRider } = { ...DEFAULT_PLAN_SETTINGS, ...settings }
    const nodes = points.map((point, index) => this.snap(point, index))
    // A leg that starts where it ends has no road to ride: an empty route that nothing downstream can draw.
    const sameSpot = nodes.findIndex((node, leg) => leg > 0 && node === nodes[leg - 1])
    if (sameSpot > 0) throw new PlanningError('sameSpot', { leg: sameSpot - 1 })
    const legs = nodes.slice(1).map((end, leg): Trip => ({ start: nodes[leg], end, includeTracks, leg }))
    const fastestLegs = legs.map((trip) => this.route(trip, FASTEST_APPETITE))
    const fastest = legs.length === 1 ? fastestLegs[0] : this.joined(fastestLegs)
    const fastestS = fastest.timeS
    const option = (route: Route) =>
      buildRideOption({
        graph: this.graph,
        points,
        start: nodes[0],
        edges: route.edges,
        legEnds: route.legEnds,
        fastestS,
        addedRoad: route.addedRoad?.edges,
        startIsRider,
      })
    onFastest?.(option(fastest))
    const legRides = legs.map((trip, leg) => this.ridesOfLeg(trip, points[leg], points[leg + 1], fastestLegs[leg], maxExtraS))
    const capS = detourCapS(maxExtraS)
    const great = [
      ...new Set(
        legRides.flatMap((rides, leg) =>
          rides.filter((ride) => ride.road && ride.timeS - fastestLegs[leg].timeS <= capS && isGreat(this.graph, ride.road, ride.edges)).map((ride) => ride.road!),
        ),
      ),
    ].sort(byFunThenRating)
    const rides = legs.length === 1 ? legRides[0] : this.wholeRides(legRides, fastestLegs.map((ride) => ride.timeS), great, maxExtraS)
    return this.sliderStops(rides, great, fastestS, maxExtraS).map(option)
  }

  /** The rides of one leg within the range: those the slider chooses among on a trip with no stops. */
  private ridesOfLeg(trip: Trip, from: LonLat, to: LonLat, fastest: Route, maxExtraS: number): Route[] {
    const fastestS = fastest.timeS
    // An appetite route can turn back at a junction to take a one-way road the other way; it rides that stretch twice,
    // which no rider asked for, so only the fastest route keeps such a turn.
    const routes = [fastest, ...APPETITES.map((appetite) => this.route(trip, appetite)).filter((route) => new Set(route.edges).size === route.edges.length)]
    const routeStretches = this.routeStretches(trip, routes)
    const ways = this.waysAround(trip, routeStretches, this.nearStretches({ from, to }, fastestS, maxExtraS), fastestS, maxExtraS)
    const rides = [...routes, ...this.ridesThrough(trip, [...routeStretches, ...ways.pool], ways), ...this.chains(trip, ways, fastestS, maxExtraS)]
    const [start, end] = [nodePosition(this.graph, trip.start), nodePosition(this.graph, trip.end)]
    return rides.filter(
      (route) =>
        route.timeS - fastestS <= maxExtraS &&
        (route === fastest || !(passes(this.graph, trip.start, route.edges, start) || passes(this.graph, trip.start, route.edges, end))),
    )
  }

  /**
   * The whole rides of a trip with stops: the Pareto sum of the legs' frontiers, the best split of every budget between
   * the legs; and, for each great road no ride of that sum rides, each leg's rides of it joined to the other legs' best
   * rides every JOIN_STEP_S of their extra time, so the road can climb the slider's ladder (joined to the other legs'
   * fastest alone, it would have less fun than the stop before it). The rider stops between legs, so a ride may turn back
   * there.
   */
  private wholeRides(legRides: Route[][], legFastestS: number[], great: Candidate[], maxExtraS: number): Route[] {
    const fastestS = legFastestS.reduce((sum, timeS) => sum + timeS, 0)
    const latestS = fastestS + maxExtraS
    const frontiers = legRides.map((rides) => paretoFrontier(rides))
    // A road ridden in two legs is fun once: a pair is scored without the fun it rides twice, or riding out and back on
    // one road would push out the pairs that ride two roads.
    const funEdges = new Map<Route, number[]>()
    const funEdgesOf = (ride: Route) => {
      if (!funEdges.has(ride)) funEdges.set(ride, ride.edges.filter((edge) => this.graph.edgeFunM[edge] > 0))
      return funEdges.get(ride)!
    }
    const ridden = new WeakMap<Joined, Set<number>>()
    const riddenBy = (whole: Joined) => {
      if (!ridden.has(whole)) ridden.set(whole, new Set(whole.parts.flatMap(funEdgesOf)))
      return ridden.get(whole)!
    }
    const join = (whole: Joined, ride: Route): Joined => {
      const twice = whole.parts.length === 0 ? 0 : funEdgesOf(ride).reduce((sum, edge) => sum + (riddenBy(whole).has(edge) ? this.graph.edgeFunM[edge] : 0), 0)
      return { timeS: whole.timeS + ride.timeS, score: whole.score + ride.score - twice, parts: [...whole.parts, ride] }
    }
    const sum = (legs: Route[][]) => legs.reduce((whole, leg) => paretoSum(whole, leg, join, latestS), [{ timeS: 0, score: 0, parts: [] } as Joined])
    const roadsOf = this.roadsRiddenBy(great)
    const whole = sum(frontiers)
    const riddenOnFrontier = new Set(whole.flatMap(({ parts }) => parts.flatMap(roadsOf)))
    const greatJoins = legRides.flatMap((rides, leg) => {
      const ofRoads = [
        ...new Set(great.flatMap((_, road) => (riddenOnFrontier.has(road) ? [] : paretoFrontier(rides.filter((ride) => roadsOf(ride).includes(road)))))),
      ]
      if (ofRoads.length === 0) return []
      const others = sum(frontiers.toSpliced(leg, 1))
      const othersFastestS = fastestS - legFastestS[leg]
      const sampled = new Set<Joined>()
      for (let budgetS = 0; budgetS <= maxExtraS; budgetS += JOIN_STEP_S) {
        const best = others.findLast((whole) => whole.timeS - othersFastestS <= budgetS)
        if (best) sampled.add(best)
      }
      return ofRoads.flatMap((ride) => [...sampled].filter((whole) => whole.timeS + ride.timeS <= latestS).map((whole) => whole.parts.toSpliced(leg, 0, ride)))
    })
    return [...whole.map(({ parts }) => parts), ...greatJoins].map((parts) => this.joined(parts))
  }

  /** The legs' rides as one, its fun counted once on an edge ridden in two legs. */
  private joined(parts: Route[]): Route {
    const edges = parts.flatMap((part) => part.edges)
    let score = 0
    for (const edge of new Set(edges)) score += this.graph.edgeFunM[edge]
    const legEnds: number[] = []
    parts.reduce((end, part) => (legEnds.push(end + part.edges.length), end + part.edges.length), 0)
    return { appetite: FASTEST_APPETITE, edges, timeS: parts.reduce((sum, part) => sum + part.timeS, 0), score, legEnds }
  }

  private snap(point: LonLat, index: number): number {
    const node = this.locator.nearest(point)
    if (node < 0) throw new PlanningError('tooFar', { point: index })
    return node
  }

  private route({ start, end, includeTracks, leg }: Trip, appetite: number): Route {
    const weights = this.weights.use(appetite, includeTracks)
    const edges = bidirectionalEdges(this.paths, this.backwardPaths, start, end, weights)
    if (!edges) throw new PlanningError('noConnection', { leg })
    return this.measure(appetite, edges)
  }

  /**
   * One appetite makes a route jump from "straight there" to "the whole mountain loop" at once. Riders also want
   * the in-betweens: ride only some consecutive twisties of a curvy route, and go the fastest way to and from them.
   */
  private routeStretches({ start }: Trip, routes: Route[]): Stretch[] {
    return routes.flatMap((route) => {
      const nodes = this.nodesAlong(start, route.edges)
      const runs = twistyStretches(this.graph, route.edges)
      return runs.flatMap(([first], i) =>
        runs.slice(i).map(([, last]) => ({
          appetite: route.appetite,
          entry: nodes[first],
          exit: nodes[last + 1],
          middle: route.edges.slice(first, last + 1),
        })),
      )
    })
  }

  /**
   * The twisty roads of the graph that no appetite makes the cheapest route: a great road a few minutes off the way costs
   * more to reach than its curves are discounted. Each one is offered in both directions if the straight lines to its ends
   * leave it within the detour cap; `waysAround` then keeps the directions that may be ridden and whose own ride does.
   */
  private nearStretches({ from, to }: { from: LonLat; to: LonLat }, fastestS: number, maxExtraS: number): Stretch[] {
    const capS = detourCapS(maxExtraS)
    return this.allCandidates()
      .filter((candidate) => this.leastExtra(candidate, from, to, fastestS).extraS <= capS)
      .flatMap((road) => [
        { appetite: FASTEST_APPETITE, entry: road.ends[0], exit: road.ends[1], middle: road.edges, road },
        { appetite: FASTEST_APPETITE, entry: road.ends[1], exit: road.ends[0], middle: road.edges.toReversed(), road },
      ])
  }

  /**
   * The fastest ways from the start to every stretch and from every stretch to the end, from one forward and one backward
   * search, and the pool: the candidate stretches whose own ride (fastest to it, the road, fastest from it) adds at most
   * the detour cap. The ways are kept only for the route's stretches and the pool.
   */
  private waysAround({ start, end, includeTracks }: Trip, routeStretches: Stretch[], near: Stretch[], fastestS: number, maxExtraS: number): Ways {
    const capS = detourCapS(maxExtraS)
    const weights = this.weights.use(FASTEST_APPETITE, includeTracks)
    this.paths.search(start, { weights, targets: routeStretches.map((s) => s.entry), optionalTargets: near.map((s) => s.entry), optionalLimit: fastestS + capS })
    this.backwardPaths.search(end, { weights, targets: routeStretches.map((s) => s.exit), optionalTargets: near.map((s) => s.exit), optionalLimit: fastestS + capS })
    const rideS = (edges: number[]) => edges.reduce((sum, edge) => sum + this.graph.edgeTimeS[edge], 0)
    const pool = near.filter(
      (s) => this.paths.costTo(s.entry) + rideS(s.middle) + this.backwardPaths.costTo(s.exit) - fastestS <= capS && isRideable(this.graph, s.entry, s.middle),
    )
    const approach = new Map<number, number[]>()
    const departure = new Map<number, number[]>()
    for (const { entry, exit } of [...routeStretches, ...pool]) {
      if (!approach.has(entry) && Number.isFinite(this.paths.costTo(entry))) approach.set(entry, this.paths.edgesTo(entry))
      if (!departure.has(exit) && Number.isFinite(this.backwardPaths.costTo(exit))) departure.set(exit, this.backwardPaths.edgesTo(exit))
    }
    return { pool, approach, departure }
  }

  /** Each stretch ridden between the fastest way from the start to its entry and from its exit to the end. */
  private ridesThrough({ start }: Trip, stretches: Stretch[], { approach, departure }: Ways): Route[] {
    return stretches.flatMap(({ appetite, entry, exit, middle, road }) => {
      const to = approach.get(entry)
      const from = departure.get(exit)
      if (!to || !from) return []
      const edges = [...to, ...middle, ...from.toReversed()]
      // The way out of a valley can be the way in: such a ride would go out and back, which no rider asked for. The legs
      // meet the stretch at its ends, where a turn could be a U-turn.
      return new Set(edges).size === edges.length && isRideable(this.graph, start, edges) ? [{ ...this.measure(appetite, edges), road }] : []
    })
  }

  /**
   * Chains of two roads or more from the pool (orienteering.ts), planned on the leg table and rebuilt as edges: the way
   * to the first road, the roads, the fastest leg between each and the next, the way from the last one. A chain that
   * rides an edge twice or turns where it may not is left out.
   */
  private chains({ start, includeTracks }: Trip, { pool, approach, departure }: Ways, fastestS: number, maxExtraS: number): Route[] {
    const legs = this.allLegs()
    const timeOf = (edges: number[] | undefined) => (edges ? edges.reduce((sum, edge) => sum + this.graph.edgeTimeS[edge], 0) : Infinity)
    const funOf = (edges: number[]) => edges.reduce((sum, edge) => sum + this.graph.edgeFunM[edge], 0)
    const candidateIndex = new Map(this.allCandidates().map((candidate, index) => [candidate, index]))
    const roads: PoolRoad[] = pool.map((s) => ({
      road: candidateIndex.get(s.road!)!,
      rideS: timeOf(s.middle),
      funM: funOf(s.middle),
      approachS: timeOf(approach.get(s.entry)),
      departureS: timeOf(departure.get(s.exit)),
    }))
    const enteredAt = new Map<number, number[]>()
    pool.forEach((s, index) => enteredAt.set(s.entry, [...(enteredAt.get(s.entry) ?? []), index]))
    // A leg that leaves a road back along it, or comes into the next one along it, would ride an edge twice.
    const exitSlot = pool.map((s) => slotOf(this.graph, s.exit, s.middle[s.middle.length - 1]))
    const entrySlot = pool.map((s) => slotOf(this.graph, s.entry, s.middle[0]))
    const out = pool.map((s, from) => {
      const legsOut = new Map<number, Leg>()
      for (const [node, leg] of legsOfEnd(legs, s.exit)) {
        if (leg.firstSlot === exitSlot[from]) continue
        for (const to of enteredAt.get(node) ?? []) if (leg.lastSlot !== entrySlot[to]) legsOut.set(to, leg)
      }
      return legsOut
    })
    const chains = chainsOfRoads(roads, out, { fastestS, rangeS: maxExtraS, stepS: CHAIN_STEP_S, maxPasses: CHAIN_PASSES })
    const weights = this.weights.use(FASTEST_APPETITE, includeTracks)
    const legEdges = new Map<string, number[] | null>()
    const legBetween = (from: number, to: number) => {
      const key = `${from}>${to}`
      if (!legEdges.has(key)) legEdges.set(key, bidirectionalEdges(this.paths, this.backwardPaths, from, to, weights))
      return legEdges.get(key)!
    }
    return chains.flatMap(({ roads: order }) => {
      if (order.length < 2) return []
      const parts = order.map((road, i) => [...(i === 0 ? approach.get(pool[road].entry)! : legBetween(pool[order[i - 1]].exit, pool[road].entry) ?? [-1]), ...pool[road].middle])
      const edges = [...parts.flat(), ...departure.get(pool[order[order.length - 1]].exit)!.toReversed()]
      return !edges.includes(-1) && new Set(edges).size === edges.length && isRideable(this.graph, start, edges) ? [this.measure(FASTEST_APPETITE, edges)] : []
    })
  }

  /**
   * The slider's stops (slider.ts), chosen among the frontier and the rides of each great road the trip may ride that no
   * other ride of it beats.
   */
  private sliderStops(rides: Route[], great: Candidate[], fastestS: number, maxExtraS: number): SliderStop[] {
    const roadsOf = this.roadsRiddenBy(great)
    const asStop = (ride: Route): SliderStop => ({ ...ride, twistyM: twistyLengthM(this.graph, ride.edges), greatRoads: roadsOf(ride) })
    const rideOfRoad = (road: number) => paretoFrontier(rides.filter((ride) => roadsOf(ride).includes(road)))
    const items = [...new Set([...paretoFrontier(rides), ...great.flatMap((_, road) => rideOfRoad(road))])].map(asStop)
    const settings = {
      fastestS,
      rangeS: maxExtraS,
      maxStops: MAX_STOPS,
      stopWorth: STOP_WORTH,
      greatRoadWeight: GREAT_ROAD_WEIGHT,
      greatRoadFunM: great.map((road) => road.funM),
    }
    const { stops, addedFor } = chooseStops(items, settings)
    return stops.map((stop, i) => (addedFor[i] === null ? stop : { ...stop, addedRoad: great[addedFor[i]!] }))
  }

  /** For each ride, the indices of the roads it rides (RIDDEN_SHARE of their length), read from an edge-to-road table. */
  private roadsRiddenBy(roads: Candidate[]): (ride: Route) => number[] {
    this.roadOfEdge.fill(-1)
    roads.forEach((road, index) => road.edges.forEach((edge) => (this.roadOfEdge[edge] = index)))
    const memo = new Map<Route, number[]>()
    return (ride) => {
      const known = memo.get(ride)
      if (known) return known
      const riddenM = new Float64Array(roads.length)
      for (const edge of ride.edges) if (this.roadOfEdge[edge] >= 0) riddenM[this.roadOfEdge[edge]] += this.graph.edgeLengthM[edge]
      const found = roads.flatMap((road, index) => (riddenM[index] >= RIDDEN_SHARE * road.lengthM ? [index] : []))
      memo.set(ride, found)
      return found
    }
  }

  /** The twisty roads of the graph, found now if they were not given. */
  allCandidates(): Candidate[] {
    this.candidates ??= findCandidates(this.graph)
    return this.candidates
  }

  /** The legs between the candidates' ends, built now if they were not given: only cheap on a small graph. */
  allLegs(): LegTable {
    this.legs ??= buildLegTable(this.graph, this.allCandidates())
    return this.legs
  }

  /** The least extra time the trip can take to ride the candidate, from the straight lines to its ends. */
  private leastExtra(candidate: Candidate, from: LonLat, to: LonLat, fastestS: number): { extraS: number; rideS: number } {
    const [first, last] = candidate.ends.map((node) => nodePosition(this.graph, node))
    const rideS = candidate.edges.reduce((sum, edge) => sum + this.graph.edgeTimeS[edge], 0)
    const legS = (a: LonLat, b: LonLat) => haversineM(a, b) / FASTEST_POSSIBLE_SPEED_MS
    const viaS = Math.min(legS(from, first) + legS(last, to), legS(from, last) + legS(first, to))
    return { extraS: Math.max(0, viaS + rideS - fastestS), rideS }
  }

  private nodesAlong(start: number, edges: number[]): number[] {
    const nodes = [start]
    for (const edge of edges) nodes.push(otherEnd(this.graph, edge, nodes[nodes.length - 1]))
    return nodes
  }

  private measure(appetite: number, edges: number[]): Route {
    let timeS = 0
    let score = 0
    for (const edge of edges) {
      timeS += this.graph.edgeTimeS[edge]
      score += this.graph.edgeFunM[edge]
    }
    return { appetite, edges, timeS, score }
  }
}

/** Whether the ride from `start` passes `point` (see PASS_NEAR_M). */
export function passes(graph: Graph, start: number, edges: number[], [lon, lat]: LonLat): boolean {
  // Distances on the plane tangent at the point: exact enough over a few km, and cheap enough for every node of every ride.
  const metresPerLon = METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180)
  const squaredM = (node: number) =>
    ((graph.nodeLonLat[node * 2] - lon) * metresPerLon) ** 2 + ((graph.nodeLonLat[node * 2 + 1] - lat) * METRES_PER_DEGREE) ** 2
  let [node, stage] = [start, 0]
  for (let i = 0; i <= edges.length; i++) {
    const distanceM2 = squaredM(node)
    if (stage !== 1 && distanceM2 > PASS_AWAY_M ** 2) {
      if (stage === 2) return true
      stage = 1
    } else if (stage === 1 && distanceM2 <= PASS_NEAR_M ** 2) stage = 2
    if (i < edges.length) node = otherEnd(graph, edges[i], node)
  }
  return false
}

/** The longest detour to a road of the graph worth offering, within the rider's budget. */
const detourCapS = (maxExtraS: number) => Math.min(maxExtraS, GREAT_ROAD_MAX_EXTRA_S)

/** Whether the road is a great one on this ride of it (see GREAT_RATING). */
function isGreat(graph: Graph, road: Candidate, rideEdges: number[]): boolean {
  const lengthOf = (edges: number[]) => edges.reduce((sum, edge) => sum + graph.edgeLengthM[edge], 0)
  const builtUpM = lengthOf(road.edges.filter((edge) => graph.edgeFlags[edge] & EdgeFlag.BuiltUp))
  if (ratingOf(road.funM / road.lengthM) < GREAT_RATING || builtUpM >= GREAT_MAX_BUILT_UP_SHARE * road.lengthM) return false
  const onRoad = new Set(road.edges)
  const twisties = twistyStretches(graph, rideEdges).map(([first, last]) => rideEdges.slice(first, last + 1))
  const around = twisties.reduce<number[]>((best, twisty) => (twisty.filter((edge) => onRoad.has(edge)).length > best.filter((edge) => onRoad.has(edge)).length ? twisty : best), [])
  return lengthOf(around) >= GREAT_MIN_TWISTY_M
}
// More fun-km first: a short pass rated 5 must not outrank a long road rated 4 (BV-5301 is a road of that kind); the rating
// only settles a tie.
const byFunThenRating = (a: Candidate, b: Candidate) => b.funM - a.funM || ratingOf(b.funM / b.lengthM) - ratingOf(a.funM / a.lengthM)
