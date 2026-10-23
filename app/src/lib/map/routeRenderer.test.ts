import type { FeatureCollection } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LonLat } from '../geo'
import type { RideOption, RouteSegment } from '../routing/ride'
import { ROUTE_GHOST, ROUTE_MOVING, ROUTE_POINTS, ROUTE_STABLE } from './layers'
import { RouteRenderer } from './routeRenderer'

/** A map that keeps what each route source holds and counts the uploads; the renderer only uploads, projects and paints. */
function fakeMap() {
  const held: Record<string, FeatureCollection> = {}
  const uploads: Record<string, number> = {}
  const map = {
    on: () => {},
    getSource: (id: string) => ({
      setData: (data: FeatureCollection) => {
        held[id] = data
        uploads[id] = (uploads[id] ?? 0) + 1
      },
    }),
    project: ([lon, lat]: LonLat) => ({ x: lon * 1000, y: lat * 1000 }),
    setPaintProperty: () => {},
  }
  return { map: map as unknown as MapLibreMap, held, uploads }
}

const segment = (kind: RouteSegment['kind'], ...line: LonLat[]): RouteSegment => ({ kind, line, ...(kind === 'twisty' ? { rating: 3 } : {}) })
const ride = (...segments: RouteSegment[]) => ({ segments }) as RideOption

const A: LonLat = [0, 40]
const B: LonLat = [0.2, 40]
const fastest = ride(segment('transit', A, [0.1, 40], B))
const curvier = ride(segment('transit', A, [0.05, 40]), segment('twisty', [0.05, 40], [0.1, 40.05], [0.15, 40]), segment('transit', [0.15, 40], B))

describe('RouteRenderer', () => {
  let frames: FrameRequestCallback[]
  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => vi.unstubAllGlobals())

  function shownAfterDrawOn() {
    const { map, held, uploads } = fakeMap()
    const renderer = new RouteRenderer(map)
    renderer.show(fastest, A, B, 1)
    // The same ride again ends the draw-on that is running.
    renderer.show(fastest, A, B, 1)
    for (const id of Object.keys(uploads)) delete uploads[id]
    frames = []
    return { renderer, held, uploads }
  }

  it('reveals the stretch that changed over several frames on a step of the slider', () => {
    const { renderer, held } = shownAfterDrawOn()
    renderer.show(curvier, A, B, 1)
    expect(frames).toHaveLength(1)
    expect(held[ROUTE_GHOST].features.length).toBeGreaterThan(0)
  })

  // A finger scrubbing passes several rides a second: one reveal each kept the whole map redrawing on every frame.
  it('swaps the ride in at once, with no reveal, while the slider is scrubbed', () => {
    const { renderer, held, uploads } = shownAfterDrawOn()
    renderer.show(curvier, A, B, 1, [], true)
    expect(frames).toHaveLength(0)
    expect(held[ROUTE_STABLE].features.map((f) => f.properties?.kind)).toEqual(['transit', 'twisty', 'transit'])
    expect(held[ROUTE_MOVING].features).toEqual([])
    expect(held[ROUTE_GHOST].features).toEqual([])
    expect(held[ROUTE_POINTS].features).toHaveLength(1)
    expect(uploads[ROUTE_STABLE]).toBe(1)
  })

  // Emptying a source re-tiles it and redraws the map just the same.
  it('leaves alone a source it has already emptied', () => {
    const { renderer, uploads } = shownAfterDrawOn()
    renderer.show(curvier, A, B, 1, [], true)
    renderer.show(fastest, A, B, 1, [], true)
    expect(uploads[ROUTE_GHOST]).toBeUndefined()
    expect(uploads[ROUTE_MOVING]).toBe(1)
  })

  it('still draws a new plan on from A to B when asked for an instant swap', () => {
    const { map } = fakeMap()
    const renderer = new RouteRenderer(map)
    renderer.show(fastest, A, B, 1, [], true)
    expect(frames).toHaveLength(1)
  })
})
