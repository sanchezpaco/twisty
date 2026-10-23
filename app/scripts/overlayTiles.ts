import type { FeatureCollection, LineString } from 'geojson'
import GeoJSONVT, { type TileCoord } from 'geojson-vt'
import vtpbf from 'vt-pbf'
import type { LonLat } from '../src/lib/geo'
import {
  OVERLAY_MAX_ZOOM,
  OVERLAY_SIMPLIFY_TOLERANCE,
  OVERLAY_TILE_BUFFER,
  OVERLAY_TILE_EXTENT,
  OVERLAY_TILE_LAYER,
} from '../src/lib/map/overlay.ts'

const MVT_VERSION = 2

export interface OverlayRoad {
  rating: number
  line: LonLat[]
}

/** MapLibre's default `maxzoom` for a GeoJSON source: geojson-vt thins every line by its tolerance at this zoom. */
const MAPLIBRE_GEOJSON_MAX_ZOOM = 18

/**
 * The overlay as vector tiles keyed `z/x/y`; a tile with nothing in it is left out.
 *
 * Zooms above the last are cut as MapLibre cuts them for a GeoJSON source. The last zoom keeps every vertex, because it
 * is what deeper zooms stretch: thinned by its own tolerance (5 m at zoom 12) hairpins would lose their corners.
 */
export function cutOverlayTiles(roads: OverlayRoad[]): Map<string, Uint8Array> {
  const data: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: roads.map(({ rating, line }) => ({ type: 'Feature', properties: { rating }, geometry: { type: 'LineString', coordinates: line } })),
  }
  const options = { indexMaxPoints: 0, extent: OVERLAY_TILE_EXTENT, buffer: OVERLAY_TILE_BUFFER }
  const coarse = new GeoJSONVT(data, { ...options, maxZoom: MAPLIBRE_GEOJSON_MAX_ZOOM, indexMaxZoom: OVERLAY_MAX_ZOOM - 1, tolerance: OVERLAY_SIMPLIFY_TOLERANCE })
  const detailed = new GeoJSONVT(data, { ...options, maxZoom: OVERLAY_MAX_ZOOM, indexMaxZoom: OVERLAY_MAX_ZOOM, tolerance: 0, generateId: true })
  const tiles = new Map<string, Uint8Array>()
  const encode = (index: GeoJSONVT, { z, x, y }: TileCoord, stripIds: boolean) => {
    const tile = index.getTile(z, x, y)
    if (!tile?.features.length) return
    const features = stripIds ? tile.features.map(({ id: _id, ...feature }) => feature) : tile.features
    tiles.set(`${z}/${x}/${y}`, vtpbf.fromGeojsonVt({ [OVERLAY_TILE_LAYER]: { features } }, { extent: OVERLAY_TILE_EXTENT, version: MVT_VERSION }))
  }
  for (const coord of coarse.tileCoords) if (coord.z < OVERLAY_MAX_ZOOM) encode(coarse, coord, false)
  const seen = new Set<number | string | undefined>()
  for (const coord of detailed.tileCoords) {
    if (coord.z !== OVERLAY_MAX_ZOOM) continue
    // The ids only exist to check below that no road went missing: they are not worth their bytes in the tiles.
    detailed.getTile(coord.z, coord.x, coord.y)?.features.forEach((feature) => seen.add(feature.id))
    encode(detailed, coord, true)
  }
  if (seen.size !== roads.length) throw new Error(`The overlay lost roads: ${seen.size} of ${roads.length} reach zoom ${OVERLAY_MAX_ZOOM}`)
  return tiles
}
