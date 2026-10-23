import type { Map as MapLibreMap } from 'maplibre-gl'
import { BADGE_LAYER, badgePaint, ghostLayer, MOVING_SUFFIX, routeLayers } from './layers'
import { mapStyle } from './style'
import { LOOKS, type MapTheme } from './theme'

export interface PaintChange {
  layer: string
  /** `visibility` is the one layout property a theme sets; every other one is paint. */
  property: string
  /** `undefined` puts the property back to MapLibre's default. */
  value: unknown
}

/** The paint and the visibility of every layer that has a look, by layer id: the base map, the overlay and everything drawn for the route. */
function themedProperties(theme: MapTheme): Map<string, Record<string, unknown>> {
  const properties = new Map<string, Record<string, unknown>>()
  for (const layer of mapStyle(theme).layers) properties.set(layer.id, { ...layer.paint, visibility: layer.layout?.visibility })
  for (const layer of [ghostLayer(theme), ...routeLayers(theme)]) {
    properties.set(layer.id, { ...layer.paint })
    properties.set(layer.id + MOVING_SUFFIX, { ...layer.paint })
  }
  properties.set(BADGE_LAYER, { ...badgePaint(theme) })
  return properties
}

/** What has to change on a map showing `from` to show `to`: only the properties whose value differs, including those `to` leaves at their default. */
export function themeChanges(from: MapTheme, to: MapTheme): PaintChange[] {
  const before = themedProperties(from)
  const changes: PaintChange[] = []
  for (const [layer, properties] of themedProperties(to)) {
    const was = before.get(layer) ?? {}
    for (const property of new Set([...Object.keys(was), ...Object.keys(properties)])) {
      const value = properties[property]
      if (JSON.stringify(was[property]) !== JSON.stringify(value)) changes.push({ layer, property, value })
    }
  }
  return changes
}

/** Switches the map from one theme to another in place: the style is not reloaded, so the route and the camera stay. */
export function applyTheme(map: MapLibreMap, from: MapTheme, to: MapTheme): void {
  for (const { layer, property, value } of themeChanges(from, to)) {
    if (!map.getLayer(layer)) continue
    if (property === 'visibility') map.setLayoutProperty(layer, property, value as never)
    else map.setPaintProperty(layer, property as never, value as never)
  }
  map.setSky(LOOKS[to].sky)
}
