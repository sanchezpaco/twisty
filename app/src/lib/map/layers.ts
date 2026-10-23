import type { FeatureCollection } from 'geojson'
import type { LineLayerSpecification, Map as MapLibreMap, SymbolLayerSpecification } from 'maplibre-gl'
import type { LonLat } from '../geo'
import { circleSdf } from './badgeImage'
import { overlayOpacity, ratingColor } from './overlay'
import { LOOKS, type MapTheme } from './theme'

export const ROUTE_STABLE = 'route'
/** The stretch of the route that is being drawn or redrawn: only this source is uploaded again on every frame. */
export const ROUTE_MOVING = 'route-moving'
/** What a step of the slider replaces, shown faintly while the new stretch draws. */
export const ROUTE_GHOST = 'route-ghost'
export const ROUTE_POINTS = 'route-points'
/** The rider's stops between start and finish. */
export const ROUTE_STOPS = 'route-stops'
/** The A and B pins are DOM markers, which label placement ignores: this layer holds their space on the map instead. */
export const ROUTE_ENDS = 'route-ends'
export const ROUTE_DIMMED_OPACITY = 0.35
/** Every route layer exists once per source, the second with this suffix; the two are drawn as one route. */
export const MOVING_SUFFIX = '-moving'
const GHOST_WIDTH_PX = 4
const GHOST_OPACITY = 0.35
/** The new badges fade in when a step has drawn. */
export const BADGE_FADE_MS = 150
const BADGE_IMAGE = 'route-badge'
const BADGE_RADIUS_PX = 11
const BADGE_MARGIN_PX = 4
const BADGE_HALO_PX = 2.5
export const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

/** Overlay and route lines go under this layer, so place and peak labels stay readable over them. */
const LABELS_BELOW = 'peaks'
/** A stop's point: 14 px across with its ring, smaller than the A and B pins. */
const STOP_RADIUS_PX = 5
const PIN_SPACE_IMAGE = 'route-pin-space'
/** The pin's 30 px dot and a little air: a place label this close would read as cut by the pin. */
const PIN_SPACE_PX = 34
/** The first label layer over the peaks, where they go back when they leave the route. */
const LABELS_OVER_PEAKS = 'place-minor'

/** While a ride is shown, the Spain-wide overlay steps back so the route stays the hero. */
export function setOverlayDimmed(map: MapLibreMap, dimmed: boolean, theme: MapTheme): void {
  const opacity = overlayOpacity(theme, dimmed)
  map.setPaintProperty('twisties-glow', 'line-opacity', opacity.glow)
  map.setPaintProperty('twisties-line', 'line-opacity', opacity.line)
}

/** Fades the route on the map while a new one is being planned, so it does not pass for the answer. */
export function setRouteDimmed(map: MapLibreMap, dimmed: boolean, theme: MapTheme): void {
  for (const layer of routeLayers(theme, dimmed ? ROUTE_DIMMED_OPACITY : 1)) {
    const opacity = layer.paint?.['line-opacity']
    map.setPaintProperty(layer.id, 'line-opacity', opacity)
    map.setPaintProperty(layer.id + MOVING_SUFFIX, 'line-opacity', opacity)
  }
}

/** The ghost of what a slider step replaces: a faint copy of the line it draws over. */
export function ghostLayer(theme: MapTheme): LineLayerSpecification {
  return {
    id: ROUTE_GHOST,
    type: 'line',
    source: ROUTE_GHOST,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': LOOKS[theme].route.ghostColor, 'line-width': GHOST_WIDTH_PX, 'line-opacity': GHOST_OPACITY },
  }
}

/** The layers of the route, bottom to top, for one theme, faded by `fade`. Each one exists for both of the route's sources. */
export function routeLayers(theme: MapTheme, fade = 1): Omit<LineLayerSpecification, 'source'>[] {
  const { ramp, route } = LOOKS[theme]
  const { twisty } = route
  const kindIs = (kind: string) => ['==', ['get', 'kind'], kind] as never
  const round = { 'line-cap': 'round', 'line-join': 'round' } as const
  const casing = (id: string, kind: string, line: typeof route.transit): Omit<LineLayerSpecification, 'source'> => ({
    id,
    type: 'line',
    filter: kindIs(kind),
    layout: round,
    paint: { 'line-color': line.casingColor, 'line-width': line.casingWidth, 'line-opacity': line.casingOpacity * fade, 'line-blur': line.casingBlur },
  })
  return [
    casing('route-transit-casing', 'transit', route.transit),
    {
      id: 'route-transit',
      type: 'line',
      filter: kindIs('transit'),
      layout: round,
      paint: { 'line-color': route.transit.color, 'line-width': route.transit.width, 'line-opacity': route.transit.opacity * fade },
    },
    casing('route-track-casing', 'track', route.track),
    // Dashed like a track on a paper map, so gravel is obvious at a glance.
    {
      id: 'route-track',
      type: 'line',
      filter: kindIs('track'),
      layout: { 'line-join': 'round' },
      paint: { 'line-color': route.track.color, 'line-width': route.track.width, 'line-dasharray': [2, 1.4], 'line-opacity': route.track.opacity * fade },
    },
    // Two unblurred bands fake the falloff of a glow: MapLibre's line blur leaves spikes at the bends.
    {
      id: 'route-twisty-halo',
      type: 'line',
      filter: kindIs('twisty'),
      layout: round,
      paint: { 'line-color': ratingColor(ramp), 'line-width': 20, 'line-opacity': twisty.haloOpacity * fade },
    },
    {
      id: 'route-twisty-glow',
      type: 'line',
      filter: kindIs('twisty'),
      layout: round,
      paint: { 'line-color': twisty.glow.color ?? ratingColor(ramp), 'line-width': twisty.glow.width, 'line-opacity': twisty.glow.opacity * fade },
    },
    {
      id: 'route-twisty-casing',
      type: 'line',
      filter: kindIs('twisty'),
      layout: round,
      paint: { 'line-color': twisty.casing.color, 'line-width': twisty.casing.width, 'line-opacity': twisty.casing.opacity * fade },
    },
    {
      id: 'route-twisty',
      type: 'line',
      filter: kindIs('twisty'),
      layout: round,
      paint: { 'line-color': ratingColor(ramp), 'line-width': twisty.width, 'line-opacity': fade },
    },
  ]
}

/** Puts the peak names under the route or back over it, as the theme asks. */
export function placePeaks(map: MapLibreMap, theme: MapTheme): void {
  map.moveLayer(LABELS_BELOW, LOOKS[theme].peaksUnderRoute ? ROUTE_GHOST : LABELS_OVER_PEAKS)
}

/** The paint of the numbered badges: a dark disc haloed in the colour of its rating. */
export function badgePaint(theme: MapTheme): SymbolLayerSpecification['paint'] {
  return {
    'icon-color': '#0b0e14',
    'icon-halo-color': ratingColor(LOOKS[theme].ramp),
    'icon-halo-width': BADGE_HALO_PX,
    'text-color': '#ffffff',
    'icon-opacity-transition': { duration: BADGE_FADE_MS },
    'text-opacity-transition': { duration: BADGE_FADE_MS },
  }
}

export const BADGE_LAYER = 'route-badges'

export function addRouteLayers(map: MapLibreMap, theme: MapTheme): void {
  for (const source of [ROUTE_STABLE, ROUTE_MOVING, ROUTE_GHOST, ROUTE_POINTS]) map.addSource(source, { type: 'geojson', data: EMPTY })
  map.addLayer(ghostLayer(theme), LABELS_BELOW)
  // Bottom to top. Each layer is added for both sources one after the other, so a casing never cuts into the line of
  // the other source at the point where the two meet.
  const layers = routeLayers(theme)
  for (const layer of layers) {
    map.addLayer({ ...layer, source: ROUTE_STABLE } as LineLayerSpecification, LABELS_BELOW)
    map.addLayer({ ...layer, id: layer.id + MOVING_SUFFIX, source: ROUTE_MOVING } as LineLayerSpecification, LABELS_BELOW)
  }
  map.addImage(BADGE_IMAGE, circleSdf(BADGE_RADIUS_PX, BADGE_MARGIN_PX), { sdf: true })
  // Badges are placed by `placeBadges`, which moves or shrinks them to keep clear of each other and of the A and B pins.
  map.addLayer({
    id: BADGE_LAYER,
    type: 'symbol',
    source: ROUTE_POINTS,
    layout: {
      'icon-image': BADGE_IMAGE,
      'icon-size': ['get', 'scale'],
      'icon-allow-overlap': true,
      'text-allow-overlap': true,
      'text-field': ['to-string', ['get', 'index']],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['*', 12, ['get', 'scale']],
      'symbol-sort-key': ['get', 'priority'],
    },
    paint: badgePaint(theme),
  })
  // The stops: plain white points with their place's name, over the line and the twisty badges (a stop is the one point
  // the rider placed, never hidden), unnumbered since the numbers are the badges'.
  map.addSource(ROUTE_STOPS, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: ROUTE_STOPS,
    type: 'circle',
    source: ROUTE_STOPS,
    paint: { 'circle-radius': STOP_RADIUS_PX, 'circle-color': '#ffffff', 'circle-stroke-width': 2, 'circle-stroke-color': '#15171c' },
  })
  map.addLayer({
    id: `${ROUTE_STOPS}-labels`,
    type: 'symbol',
    source: ROUTE_STOPS,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      // The name steps to whichever side is free of a badge.
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
      'text-radial-offset': 0.9,
      // The rider's own stop is always named, even where the map's labels or a badge are near.
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0, 0, 0, 0.75)', 'text-halo-width': 1.4 },
  })
  // An empty icon where each pin stands, over every label layer: it is placed first and the map's labels give way to it,
  // so a town under a pin loses its label instead of showing it cut in two.
  map.addImage(PIN_SPACE_IMAGE, { width: PIN_SPACE_PX, height: PIN_SPACE_PX, data: new Uint8Array(PIN_SPACE_PX * PIN_SPACE_PX * 4) })
  map.addSource(ROUTE_ENDS, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: ROUTE_ENDS,
    type: 'symbol',
    source: ROUTE_ENDS,
    layout: { 'icon-image': PIN_SPACE_IMAGE, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
  })
}

/** Where the A and B pins stand, for the layer that keeps labels clear of them. */
export function routeEnds(...ends: (LonLat | null)[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ends.flatMap((position) => (position ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: position } }] : [])),
  }
}
