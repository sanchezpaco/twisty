import type {
  ExpressionSpecification,
  LayerSpecification,
  RasterDEMSourceSpecification,
  RasterSourceSpecification,
  StyleSpecification,
} from 'maplibre-gl'
import { OVERLAY_MAX_ZOOM, OVERLAY_SOURCE, OVERLAY_TILE_LAYER, overlayLayers } from './overlay'
import { DEFAULT_THEME, IMAGERY_LAYERS, LOOKS, type MapLook, type MapTheme } from './theme'
import { OVERLAY_TILES_URL } from './overlayProtocol'

const OPENFREEMAP_TILES = 'https://tiles.openfreemap.org/planet'
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
const TERRARIUM_TILES = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'
export const TERRAIN_SOURCE = 'terrain'
const IGN_ORTHO_TILES =
  'https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetTile&version=1.0.0&layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}&format=image/jpeg'
/**
 * The years each credit covers. Re-check them when IGN announces an update (https://www.ign.es/ign/rss): the PNOA
 * flights in the capabilities of the WMTS and the MosaicoSentinel2 record of the CNIG download centre.
 */
export const IMAGERY_YEARS = { pnoa: '2022-2025', sentinel: '2018-2026' }
/** The base map's short credit, always on screen at the map's foot (OSMF attribution guideline); the (i) keeps the full text. */
export const OSM_CREDIT =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a>'
export const PNOA_CREDIT = `<a href="https://pnoa.ign.es/" target="_blank" rel="noopener">PNOA</a> ${IMAGERY_YEARS.pnoa} CC-BY 4.0 <a href="https://www.scne.es/" target="_blank" rel="noopener">scne.es</a>`
export const SENTINEL_CREDIT = `MosaicoSentinel2 ${IMAGERY_YEARS.sentinel} CC-BY 4.0 <a href="https://www.ign.es/" target="_blank" rel="noopener">ign.es</a>, contains modified Copernicus Sentinel data`
/**
 * IGN serves PNOA from its tile level 13 and Sentinel-2 below. Its tiles are 256 px, which MapLibre asks for at level
 * round(zoom + 1), so the orthophotos start at map zoom 11.5. The one URL is split into two sources at that zoom, each
 * with its own credit: MapLibre credits a source only while a layer of it is drawn.
 */
export const PNOA_FROM_ZOOM = 11.5
const IGN_MAX_LEVEL = 19
/** IGN's Sentinel-2 mosaic: the levels under PNOA's. */
const SENTINEL_MAX_LEVEL = 12
const IMAGERY_FADE_MS = 300
const [SENTINEL_LAYER, PNOA_LAYER] = IMAGERY_LAYERS
const REGULAR = ['Noto Sans Regular']
const BOLD = ['Noto Sans Bold']
const ITALIC = ['Noto Sans Italic']

const demSource: RasterDEMSourceSpecification = {
  type: 'raster-dem',
  tiles: [TERRARIUM_TILES],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 13,
  attribution: '<a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a>: EU-DEM (Copernicus), SRTM/GMTED (USGS), ETOPO1 (NOAA)',
}

const imagerySource = (attribution: string, maxzoom: number): RasterSourceSpecification => ({
  type: 'raster',
  tiles: [IGN_ORTHO_TILES],
  tileSize: 256,
  maxzoom,
  attribution,
})

const zoomWidth = (stops: [number, number][]) =>
  ['interpolate', ['exponential', 1.5], ['zoom'], ...stops.flat()] as ExpressionSpecification

export function mapStyle(theme: MapTheme = DEFAULT_THEME): StyleSpecification {
  const look = LOOKS[theme]
  const { colors: c, sky, hillshade, labelHaloBlur } = look
  const halo = (width: number) => ({ 'text-halo-color': c.halo, 'text-halo-width': width, 'text-halo-blur': labelHaloBlur })
  const style: StyleSpecification = {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      openmaptiles: { type: 'vector', url: OPENFREEMAP_TILES },
      // Cut by the pipeline (`make data`); a tile with no twisties is not shipped, see `loadOverlayTile`.
      [OVERLAY_SOURCE]: { type: 'vector', tiles: [OVERLAY_TILES_URL], maxzoom: OVERLAY_MAX_ZOOM },
      // One DEM source feeds both the hillshade and the 3D terrain, so each tile is fetched and held once.
      [TERRAIN_SOURCE]: demSource,
      // A source none of whose layers is drawn fetches nothing, so a rider who never picks satellite never contacts IGN.
      [SENTINEL_LAYER]: imagerySource(SENTINEL_CREDIT, SENTINEL_MAX_LEVEL),
      // No minimum level: tilted in 3D, the far half of the view asks for coarser tiles than the camera's zoom.
      [PNOA_LAYER]: imagerySource(PNOA_CREDIT, IGN_MAX_LEVEL),
    },
    sky,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': c.land } },
      {
        id: 'landcover-wood',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: { 'fill-color': c.wood, 'fill-opacity': 0.8 },
      },
      {
        id: 'landcover-grass',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland', 'wetland']]],
        paint: { 'fill-color': c.grass, 'fill-opacity': 0.6 },
      },
      {
        id: 'landuse-urban',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'industrial', 'commercial']]],
        paint: { 'fill-color': c.urban, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 12, 0.9] },
      },
      {
        id: 'hillshade',
        type: 'hillshade',
        source: TERRAIN_SOURCE,
        paint: {
          'hillshade-method': 'igor',
          'hillshade-exaggeration': hillshade.exaggeration,
          'hillshade-shadow-color': hillshade.shadow,
          'hillshade-highlight-color': hillshade.highlight,
          'hillshade-accent-color': hillshade.accent,
          'hillshade-illumination-direction': 315,
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': c.water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        minzoom: 8,
        paint: { 'line-color': c.waterLine, 'line-width': zoomWidth([[8, 0.5], [14, 2]]) },
      },
      // Over the fills, which show through only where the photo has not loaded. Unmodified, as its licence requires:
      // no brightness, contrast, saturation or hue change.
      imageryLayer(SENTINEL_LAYER, { maxzoom: PNOA_FROM_ZOOM }),
      imageryLayer(PNOA_LAYER, { minzoom: PNOA_FROM_ZOOM }),
      {
        id: 'boundary-country',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
        paint: { 'line-color': c.border, 'line-width': 1.2, 'line-dasharray': [3, 2] },
      },
      {
        id: 'boundary-region',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
        minzoom: 5,
        paint: { 'line-color': c.border, 'line-width': 0.6, 'line-opacity': 0.5, 'line-dasharray': [2, 2] },
      },
      roadLayer('road-minor', ['minor', 'service', 'track'], c.minor, [[11, 0.3], [16, 4]], 11, look),
      roadLayer('road-secondary', ['secondary', 'tertiary'], c.secondary, [[7, 0.3], [16, 6]], 7, look),
      roadLayer('road-primary', ['primary', 'trunk'], c.primary, [[5, 0.4], [16, 8]], 5, look),
      roadLayer('road-motorway', ['motorway'], c.motorway, [[4, 0.5], [16, 10]], 4, look),
      // Under the labels, so place and peak names stay readable over the lines.
      ...overlayLayers(OVERLAY_TILE_LAYER, theme),
      {
        id: 'peaks',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'mountain_peak',
        minzoom: 9,
        filter: ['has', 'ele'],
        layout: {
          'text-field': ['concat', '▲ ', ['get', 'name'], '\n', ['to-string', ['get', 'ele']], ' m'],
          'text-font': ITALIC,
          'text-size': 10,
          'text-line-height': 1.3,
        },
        paint: { 'text-color': c.peak, ...halo(1.2) },
      },
      {
        id: 'place-minor',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        minzoom: 9,
        filter: ['in', ['get', 'class'], ['literal', ['village', 'hamlet']]],
        layout: { 'text-field': ['get', 'name'], 'text-font': REGULAR, 'text-size': 10.5 },
        paint: { 'text-color': c.label, ...halo(1.2) },
      },
      {
        id: 'place-town',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        minzoom: 7,
        filter: ['==', ['get', 'class'], 'town'],
        layout: { 'text-field': ['get', 'name'], 'text-font': REGULAR, 'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 12, 14] },
        paint: { 'text-color': c.label, ...halo(1.4) },
      },
      {
        id: 'place-city',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['==', ['get', 'class'], 'city'],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': BOLD,
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 17],
          'text-letter-spacing': 0.04,
        },
        paint: { 'text-color': c.labelStrong, ...halo(1.6) },
      },
    ],
  }
  for (const layer of style.layers) if (look.hidden.includes(layer.id)) layer.layout = { ...layer.layout, visibility: 'none' }
  return style
}

function imageryLayer(id: string, zooms: { minzoom?: number; maxzoom?: number }): LayerSpecification {
  return { id, type: 'raster', source: id, ...zooms, paint: { 'raster-fade-duration': IMAGERY_FADE_MS } }
}

function roadLayer(
  id: string,
  classes: string[],
  color: string,
  widths: [number, number][],
  minzoom: number,
  { photoRoads }: MapLook,
): LayerSpecification {
  const paint = photoRoads
    ? {
        'line-color': color,
        'line-width': zoomWidth(photoRoads.zooms.map((zoom, i) => [zoom, photoRoads.width[i]])),
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          photoRoads.zooms[0] - 1,
          0,
          photoRoads.zooms[0],
          photoRoads.opacity,
          photoRoads.zooms[1],
          photoRoads.opacity,
          photoRoads.goneBy,
          0,
        ] as ExpressionSpecification,
      }
    : { 'line-color': color, 'line-width': zoomWidth(widths) }
  return {
    id,
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    minzoom,
    filter: ['in', ['get', 'class'], ['literal', classes]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint,
  }
}
