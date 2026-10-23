import type { ExpressionSpecification, LineLayerSpecification } from 'maplibre-gl'
import { DEFAULT_THEME, LOOKS, type MapTheme, type Ramp } from './theme.ts'

/** The rating of a feature as a colour of the ramp. */
export const ratingColor = (ramp: Ramp) =>
  ['match', ['get', 'rating'], 1, ramp[0], 2, ramp[1], 3, ramp[2], 4, ramp[3], ramp[4]] as ExpressionSpecification

export const OVERLAY_SOURCE = 'twisties'
/** The one layer inside each overlay tile; its features carry only `rating`. */
export const OVERLAY_TILE_LAYER = 'twisties'
/** Tiles are cut up to this zoom; the last one keeps every vertex and deeper zooms stretch it. */
export const OVERLAY_MAX_ZOOM = 12

// The tiler settings are MapLibre's own for a GeoJSON source (8192 units per 512 px tile, tolerance 0.375 px), so a
// tile holds what MapLibre would have cut at run time. Only the buffer is ours: it must cover half the widest line
// (glow, 16 px plus 10 px of blur) and MapLibre's 128 px makes the files 74% bigger for nothing visible.
export const OVERLAY_TILE_EXTENT = 8192
export const OVERLAY_SIMPLIFY_TOLERANCE = 6
export const OVERLAY_TILE_BUFFER = 512

type Fade = { zooms: [number, number]; share: number } | null

/** An opacity that rises from a share of itself between two zooms and falls to nothing between two others, or stays as it is. */
export function zoomedOpacity(opacity: number, fadeIn: Fade, fadeOut: [number, number] | null): number | ExpressionSpecification {
  const stops = [
    ...(fadeIn ? [fadeIn.zooms[0], opacity * fadeIn.share, fadeIn.zooms[1], opacity] : []),
    ...(fadeOut ? [fadeOut[0], opacity, fadeOut[1], 0] : []),
  ]
  return stops.length ? (['interpolate', ['linear'], ['zoom'], ...stops] as ExpressionSpecification) : opacity
}

/** The Spain-wide overlay steps back while a ride is shown, so the route is the only full-strength colour. */
export function overlayOpacity(theme: MapTheme, dimmed: boolean) {
  const { glow, line, dimmedFadeOut } = LOOKS[theme].overlay
  const fadeOut = dimmed ? dimmedFadeOut : null
  return {
    glow: zoomedOpacity(dimmed ? glow.dimmedOpacity : glow.opacity, glow.fadeIn, fadeOut),
    line: zoomedOpacity(dimmed ? line.dimmedOpacity : line.opacity, null, fadeOut),
  }
}

const round: LineLayerSpecification['layout'] = { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'rating'] }

/** The glow and the line of the Spain-wide overlay, in drawing order. Pass the tile layer for the vector tiles; a GeoJSON source (the parity check) has none. */
export function overlayLayers(sourceLayer?: string, theme: MapTheme = DEFAULT_THEME): LineLayerSpecification[] {
  const { ramp, overlay } = LOOKS[theme]
  const { glow } = overlay
  const opacity = overlayOpacity(theme, false)
  const source = { source: OVERLAY_SOURCE, ...(sourceLayer ? { 'source-layer': sourceLayer } : {}) }
  return [
    {
      id: 'twisties-glow',
      type: 'line',
      ...source,
      layout: round,
      paint: {
        'line-color': glow.color ?? ratingColor(ramp),
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, glow.width[0], 12, glow.width[1]],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 5, glow.blur[0], 12, glow.blur[1]],
        'line-opacity': opacity.glow,
        'line-opacity-transition': { duration: 600 },
      },
    },
    {
      id: 'twisties-line',
      type: 'line',
      ...source,
      layout: round,
      paint: {
        'line-color': ratingColor(ramp),
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.9, 12, 3.2],
        'line-opacity': opacity.line,
        'line-opacity-transition': { duration: 600 },
      },
    },
  ]
}
