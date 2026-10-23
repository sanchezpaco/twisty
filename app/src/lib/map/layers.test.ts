import type { Map as MapLibreMap } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import { addRouteLayers, ROUTE_ENDS, routeEnds } from './layers'

/** Just enough of a map to record what the route layers add, in order. */
function recordingMap() {
  const layers: { id: string; layout?: Record<string, unknown>; before?: string }[] = []
  const map = {
    addSource: () => {},
    addImage: () => {},
    addLayer: (layer: { id: string; layout?: Record<string, unknown> }, before?: string) => layers.push({ ...layer, before }),
  }
  return { map: map as unknown as MapLibreMap, layers }
}

describe('the space the A and B pins hold', () => {
  it('is the top layer, drawn over every label and kept clear by them', () => {
    const { map, layers } = recordingMap()
    addRouteLayers(map, 'dark')
    const ends = layers.at(-1)!
    expect(ends.id).toBe(ROUTE_ENDS)
    expect(ends.before).toBeUndefined()
    expect(ends.layout).toMatchObject({ 'icon-allow-overlap': true, 'icon-ignore-placement': false })
  })

  it('stands where each placed pin is, and nowhere for a pin not placed yet', () => {
    expect(routeEnds([-0.55, 42.57], null).features.map((feature) => feature.geometry)).toEqual([{ type: 'Point', coordinates: [-0.55, 42.57] }])
    expect(routeEnds(null, null).features).toEqual([])
  })
})
