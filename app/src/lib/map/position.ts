import type { FeatureCollection } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { RiderFix } from '../locate'
import { EMPTY } from './layers'

/** The rider's position: a dot with a halo as wide as the fix may be off. Drawn over the route, under the A and B pins. */
export const RIDER_POSITION = 'rider-position'
const DOT_RADIUS_PX = 7
const DOT_COLOR = '#4c8dff'
const HALO_OPACITY = 0.18
/** How many metres one pixel covers at zoom 0 on the equator, for MapLibre's 512 px tiles. */
const METRES_PER_PX_AT_ZOOM_0 = 40_075_016.686 / 512
const MAX_ZOOM = 24

/** The halo's radius at zoom 0, in pixels; each zoom level doubles it. */
export function haloRadiusAtZoom0(accuracyM: number, latitude: number): number {
  return accuracyM / (METRES_PER_PX_AT_ZOOM_0 * Math.cos((latitude * Math.PI) / 180))
}

export function riderPositionData(fix: RiderFix | null): FeatureCollection {
  if (!fix) return EMPTY
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { halo: haloRadiusAtZoom0(fix.accuracyM, fix.position[1]) },
        geometry: { type: 'Point', coordinates: fix.position },
      },
    ],
  }
}

export function addRiderPositionLayers(map: MapLibreMap): void {
  map.addSource(RIDER_POSITION, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: `${RIDER_POSITION}-halo`,
    type: 'circle',
    source: RIDER_POSITION,
    paint: {
      'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, ['get', 'halo'], MAX_ZOOM, ['*', ['get', 'halo'], 2 ** MAX_ZOOM]],
      'circle-color': DOT_COLOR,
      'circle-opacity': HALO_OPACITY,
      'circle-pitch-alignment': 'map',
    },
  })
  map.addLayer({
    id: RIDER_POSITION,
    type: 'circle',
    source: RIDER_POSITION,
    paint: { 'circle-radius': DOT_RADIUS_PX, 'circle-color': DOT_COLOR, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff' },
  })
}
