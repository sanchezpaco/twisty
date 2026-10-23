import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RoadClass } from '../../src/lib/data/graph'
import { EdgeWeights } from '../../src/lib/routing/edgeWeights'
import { ShortestPaths } from '../../src/lib/routing/shortestPaths'
import { graphBuffer, graphFixture } from '../../src/lib/testing/graphFixture'
import { walkProblem } from '../checks'
import { type KnownRoad, locateRoad } from '../roads'
import type { BenchTrip } from '../trips'
import { LOCAL_ROADS, metresInFunWindows, roadRuns } from './card'
import { distinctRoutes, oursIsX, sampleStops, shuffled, stopNearestCost } from './dossier'
import { evaluate, evaluateTrips } from './evaluate'
import { forcedRoutes } from './forced'
import { addedMisses, CONTROL_COUNT, freeze, HEAD_TO_HEAD_TRIPS, NOTHING_ADDED, pairId, ranked, readTripsFile, SAMPLE_COUNT } from './frozen'

//  A -- B -- C        A to B and B to C on a primary road; from B to C a twisty CV-25 and a track as well
//        \__/          D hangs off A on a dull road named like the twisty, to check that runs split on the ref
const nodes: [number, number][] = [[0, 0], [0.03, 0], [0.06, 0], [-0.03, 0]]
const names = ['', 'CV-25 · Carretera de la Sierra', 'N-1', 'Calle Mayor']
const fixture = [
  { from: 0, to: 1, timeS: 300, lengthM: 5_000, roadClass: RoadClass.Primary, road: 2 },
  { from: 1, to: 2, timeS: 300, lengthM: 5_000, roadClass: RoadClass.Primary, road: 2 },
  { from: 1, to: 2, timeS: 700, lengthM: 5_000, funM: 4_800, roadClass: RoadClass.Tertiary, road: 1, geometry: [[0.04, 0.004], [0.05, 0.004]] as [number, number][] },
  { from: 0, to: 3, timeS: 100, lengthM: 800, roadClass: RoadClass.Residential, road: 3 },
]
const graph = graphFixture(nodes, fixture, names)
const trip: BenchTrip = { id: 't', kind: 'fixed', set: 'tuning', from: [0, 0], to: [0.06, 0], includeTracks: false, fromName: 'A', toName: 'C' }
const sierra: KnownRoad = { id: 'sierra', ref: 'CV-25', region: 'x', from: [0.03, 0], to: [0.06, 0], why: '', addedBy: 't', addedOn: '2026-01-01' }

describe('roadRuns', () => {
  it('lists the roads in riding order, folding short runs into local roads', () => {
    expect(roadRuns(graph, [3, 0, 1])).toEqual([{ road: LOCAL_ROADS, km: 0.8 }, { road: 'N-1', km: 10 }])
    expect(roadRuns(graph, [0, 2])).toEqual([{ road: 'N-1', km: 5 }, { road: 'CV-25 · Carretera de la Sierra', km: 5 }])
  })

  it('keeps one road across a short stretch of local roads between its runs', () => {
    const wide = graphFixture(nodes, [fixture[0], { ...fixture[3], from: 1, to: 2 }, { ...fixture[0], from: 2, to: 3 }], names)
    expect(roadRuns(wide, [0, 1, 2])).toEqual([{ road: 'N-1', km: 10.8 }])
  })
})

describe('metresInFunWindows', () => {
  it('counts the edges whose surrounding window holds the share', () => {
    expect(metresInFunWindows(graph, [2], 0.8)).toBe(5_000)
    expect(metresInFunWindows(graph, [0, 1], 0.8)).toBe(0)
  })
})

describe('the stops of a trip', () => {
  const options = [{ extraS: 0, curvyM: 0 }, { extraS: 600, curvyM: 5 }, { extraS: 1_800, curvyM: 9 }, { extraS: 3_600, curvyM: 9 }]

  it('takes the stop nearest in cost, the cheaper one on a tie', () => {
    expect(stopNearestCost(options, 1_000)).toBe(1)
    expect(stopNearestCost(options, 1_200)).toBe(1)
    expect(stopNearestCost(options, 5_000)).toBe(3)
  })

  it('takes the default stop and the first stop with the most fun', () => {
    expect(sampleStops(options)).toEqual({ default: 2, fun: 2 })
    expect(sampleStops([{ extraS: 0, curvyM: 0 }])).toEqual({ default: 0, fun: 0 })
  })
})

describe('the shuffles', () => {
  it('give the same order whatever the order of the list and what else is in it', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }))
    const order = (list: { id: string }[]) => shuffled(list, 7).map((item) => item.id)
    expect(order([...items].reverse())).toEqual(order(items))
    expect(order(items.filter((item) => item.id !== 'c'))).toEqual(order(items).filter((id) => id !== 'c'))
    expect(ranked(items, 'other', (item) => item.id, 7)).not.toEqual(ranked(items, 'order', (item) => item.id, 7))
  })

  it('draw the side of our route from the pair and the seed alone', () => {
    const sides = Array.from({ length: 200 }, (_, index) => oursIsX(`p-${index}`, 1))
    expect(sides.filter(Boolean).length).toBeGreaterThan(70)
    expect(sides.filter(Boolean).length).toBeLessThan(130)
    expect(oursIsX('p-1', 1)).toBe(oursIsX('p-1', 1))
  })
})

describe('forcedRoutes', () => {
  it('walks from the start to the end through the whole road, whichever way is quicker', () => {
    const located = locateRoad(graph, sierra, 1)
    if (!('located' in located)) throw new Error('the fixture road should be located')
    const searches = { fromStart: new ShortestPaths(graph), fromEnd: new ShortestPaths(graph, 'backward') }
    const routes = forcedRoutes(searches, new EdgeWeights(graph), { start: 0, end: 2, includeTracks: false }, [located.located])
    expect(routes.get('sierra')).toEqual({ start: 0, edges: [0, 2] })
    expect(walkProblem(graph, [0, 2], 0, 2)).toBeNull()
  })
})

describe('freeze', () => {
  const trips = Array.from({ length: 60 }, (_, index): BenchTrip => ({ ...trip, id: `trip-${index}`, kind: 'regional', includeTracks: index === 0 }))
  const great = (found: boolean) => ({ deadEnd: false, costS: 600, demanded: true, foundAt: found ? 1 : null, lastRides: false, costRatio: found ? 1.5 : null })
  const results = trips.map((one, index) => ({ id: one.id, greatRoads: { sierra: great(index % 3 !== 0), other: { ...great(false), demanded: false } } }))
  const baseline = { header: { commit: 'abc', dataHash: 'def' }, results }
  const roads = [sierra, { ...sierra, id: 'other' }]
  const frozen = freeze({ baseline, trips, roads })

  it('keeps every demanded miss and a seeded sample of the finds and of the trips', () => {
    expect(frozen.misses).toHaveLength(results.filter((_, index) => index % 3 === 0).length)
    expect(frozen.misses.every((pair) => pair.road === 'sierra')).toBe(true)
    expect(frozen.controls).toHaveLength(CONTROL_COUNT)
    expect(frozen.sample).toHaveLength(SAMPLE_COUNT)
    for (const { id } of HEAD_TO_HEAD_TRIPS) expect(frozen.sample).toContain(id)
    expect(frozen.roads.map((road) => road.id)).toEqual(['sierra'])
  })

  it('never samples a trip that rides tracks, and freezes the ends of every trip it names', () => {
    expect(frozen.sample).not.toContain('trip-0')
    const known = new Set(frozen.trips.map((one) => one.id))
    expect([...frozen.misses, ...frozen.controls].every((pair) => known.has(pair.trip))).toBe(true)
    expect(frozen.trips.find((one) => one.id === frozen.misses[0].trip)).toEqual({ id: frozen.misses[0].trip, name: 'A → C', from: [0, 0], to: [0.06, 0] })
  })

  it('draws the same lists from a baseline in another order', () => {
    expect(freeze({ baseline: { ...baseline, results: [...results].reverse() }, trips: [...trips].reverse(), roads })).toEqual(frozen)
  })

  it('takes no control whose stop is the forced route itself', () => {
    const same = results.map((result) => ({ ...result, greatRoads: { sierra: { ...great(true), costRatio: 1.004 } } }))
    expect(freeze({ baseline: { ...baseline, results: same }, trips, roads }).controls).toEqual([])
  })

  it('takes no control that costs far more than the forced route', () => {
    const dear = results.map((result) => ({ ...result, greatRoads: { sierra: { ...great(true), costRatio: 3 } } }))
    expect(freeze({ baseline: { ...baseline, results: dear }, trips, roads }).controls).toEqual([])
  })

  it('adds only the misses the frozen list does not have', () => {
    const later = results.map((result, index) => (index === 1 ? { ...result, greatRoads: { sierra: great(false) } } : result))
    const added = addedMisses(frozen, later, trips, roads)
    expect(added.pairs).toEqual([{ trip: 'trip-1', road: 'sierra' }])
    expect(added.trips.map((one) => one.id)).toEqual(['trip-1'])
    expect(addedMisses(frozen, results, trips, roads)).toEqual({ trips: [], roads: [], pairs: [] })
  })
})

describe('evaluate', () => {
  const pair = { trip: 't', road: 'sierra' }
  const frozen = {
    seed: 5,
    from: { commit: 'abc', dataHash: 'def' },
    trips: [{ id: 't', name: 'A → C', from: trip.from, to: trip.to }],
    roads: [sierra],
    misses: [],
    controls: [pair],
    sample: ['t'],
  }
  const dataDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'twisty-eval-'))
    writeFileSync(join(dir, 'graph.bin'), new Uint8Array(graphBuffer(nodes, fixture, names)))
    writeFileSync(join(dir, 'prompt.md'), 'Judge it.')
    return dir
  }

  it('writes a blind dossier, its key and the prompt for a control pair, and one route for a sample trip whose two stops are the same', () => {
    const dir = dataDir()
    const out = join(dir, 'out')
    expect(evaluate({ dataDir: dir, frozen, added: NOTHING_ADDED, outDir: out, commit: 'xyz', promptPath: join(dir, 'prompt.md') })).toBe(0)

    const key = JSON.parse(readFileSync(join(out, 'key.json'), 'utf8'))
    expect(key.pairs).toEqual([expect.objectContaining({ id: pairId(pair, 5), list: 'control', trip: 't', road: 'sierra', forcedCostMin: 6.7, ours: { rides: true } })])
    expect(key.sample.map((one: { slots: string[] }) => one.slots)).toEqual([['default', 'fun']])
    const [item] = JSON.parse(readFileSync(join(out, 'pairs.json'), 'utf8'))
    expect(item.x.roads).toEqual(item.y.roads)
    const text = readFileSync(join(out, 'pairs.md'), 'utf8')
    expect(text).toContain(pairId(pair, 5))
    expect(text).not.toMatch(/ours|forced|demanded|control/)
    expect(readFileSync(join(out, 'judge-prompt.md'), 'utf8')).toBe('Judge it.')
  })

  it('gives a control that became a miss an id of its own in the added list', () => {
    const dir = dataDir()
    const added = { trips: [], roads: [], pairs: [pair] }
    evaluate({ dataDir: dir, frozen, added, outDir: join(dir, 'out'), commit: 'xyz', promptPath: join(dir, 'prompt.md') })

    const ids = JSON.parse(readFileSync(join(dir, 'out', 'key.json'), 'utf8')).pairs.map((key: { id: string }) => key.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    expect(ids.every((id: string) => id.startsWith('p-'))).toBe(true)
  })
})

describe('distinctRoutes', () => {
  it('keeps a route two versions share once, with both versions in its key', () => {
    const routes = [
      { version: 0, slots: ['default' as const], stop: 1, edges: [0, 1] },
      { version: 0, slots: ['fun' as const], stop: 3, edges: [0, 2] },
      { version: 1, slots: ['default' as const, 'fun' as const], stop: 2, edges: [0, 2] },
    ]
    expect(distinctRoutes(routes)).toEqual([
      { edges: [0, 1], versions: [{ version: 0, slots: ['default'], stop: 1 }] },
      { edges: [0, 2], versions: [{ version: 0, slots: ['fun'], stop: 3 }, { version: 1, slots: ['default', 'fun'], stop: 2 }] },
    ])
  })
})

describe('evaluateTrips', () => {
  const dataDir = (graph: ArrayBuffer) => {
    const dir = mkdtempSync(join(tmpdir(), 'twisty-trips-'))
    writeFileSync(join(dir, 'graph.bin'), new Uint8Array(graph))
    writeFileSync(join(dir, 'prompt.md'), 'Judge it.')
    return dir
  }
  const trips = [{ id: 't', name: 'A → C', from: trip.from, to: trip.to }]

  it('writes absolute cards only, one per distinct route of all the versions, with the versions in the key', () => {
    const [v1, v2] = [dataDir(graphBuffer(nodes, fixture, names)), dataDir(graphBuffer(nodes, fixture, names))]
    const out = join(v1, 'out')
    expect(evaluateTrips({ dataDirs: [v1, v2], trips, seed: 7, outDir: out, commit: 'xyz', promptPath: join(v1, 'prompt.md') })).toBe(0)

    const key = JSON.parse(readFileSync(join(out, 'key.json'), 'utf8'))
    expect(key.data).toHaveLength(2)
    expect(key.sample).toEqual([{ id: expect.stringMatching(/^o-/), trip: 't', versions: [{ version: 0, slots: ['default', 'fun'], stop: 1 }, { version: 1, slots: ['default', 'fun'], stop: 1 }] }])
    const text = readFileSync(join(out, 'absolute.md'), 'utf8')
    expect(text).toContain(key.sample[0].id)
    expect(text).not.toMatch(/version|v1|v2/)
  })

  it('refuses data folders whose graphs differ in shape, or join other nodes with as many edges', () => {
    const v1 = dataDir(graphBuffer(nodes, fixture, names))
    const fewer = dataDir(graphBuffer(nodes, fixture.slice(0, 3), names))
    const rewired = dataDir(graphBuffer(nodes, fixture.map((edge, index) => (index === 3 ? { ...edge, from: 2 } : edge)), names))
    for (const other of [fewer, rewired]) {
      expect(() => evaluateTrips({ dataDirs: [v1, other], trips, seed: 7, outDir: join(v1, 'out'), commit: 'xyz', promptPath: join(v1, 'prompt.md') })).toThrow(/graph shape/)
    }
  })

  it('reads a trips file only when every trip has an id, a name and two ends', () => {
    const dir = mkdtempSync(join(tmpdir(), 'twisty-trips-file-'))
    let files = 0
    const file = (content: unknown) => {
      const path = join(dir, `${files++}.json`)
      writeFileSync(path, JSON.stringify(content))
      return path
    }
    const good = { seed: 3, note: 'extra keys are fine', trips: [{ ...trips[0], kind: 'regional' }] }
    expect(readTripsFile(file(good))).toEqual({ seed: 3, trips })
    expect(() => readTripsFile(file({ ...good, seed: '3' }))).toThrow(/seed/)
    expect(() => readTripsFile(file({ ...good, trips: [] }))).toThrow(/at least one/)
    expect(() => readTripsFile(file({ ...good, trips: [{ ...trips[0], to: [1] }] }))).toThrow(/ends/)
    expect(() => readTripsFile(file({ ...good, trips: [trips[0], trips[0]] }))).toThrow(/twice/)
  })
})
