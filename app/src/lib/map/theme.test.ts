import { describe, expect, it } from 'vitest'
import { contrast, deltaE, hue, lightness, over, VISION } from '../testing/colors'
import { routeLayers } from './layers'
import { overlayLayers, overlayOpacity, zoomedOpacity } from './overlay'
import { mapStyle } from './style'
import { DEFAULT_THEME, IMAGERY_LAYERS, LOOKS, MAP_COLORS, MAP_THEMES, type MapLook, type MapTheme, parseTheme, PHOTO_SAMPLES, RATING_COLORS } from './theme'
import { applyTheme, themeChanges } from './themeApply'

const visions = Object.keys(VISION) as (keyof typeof VISION)[]

/** Two bands of a line differ enough to see: in luminance, or in hue by as much as a person with any colour vision sees it. */
const MIN_BAND_CONTRAST = 3
const MIN_BAND_DELTA_E = 20
/** Dark water a step of hue away from the land: it was near-black on near-black (1.2) and reservoirs vanished. */
const MIN_WATER_DELTA_E = 8
const apart = (a: string, b: string) => contrast(a, b) >= MIN_BAND_CONTRAST || visions.every((vision) => deltaE(a, b, vision) >= MIN_BAND_DELTA_E)
const apartInNormalVision = (a: string, b: string) => contrast(a, b) >= MIN_BAND_CONTRAST || deltaE(a, b) >= MIN_BAND_DELTA_E

/** What a route must reach on the fills of the map, and on the bounds of how dark the relief can make them. */
const ROUTE_CONTRAST_ON_FILLS = 4.5
const CONTRAST_ON_SHADED_BOUNDS = 3
/**
 * The transit leg is a slate line in a white rim, so it is read by its own two tones; the bounds are darker than any
 * tile (see `shadedBoundsOf`), and the slate the cartographer chose holds 2.45:1 on the darkest of them.
 */
const TRANSIT_CONTRAST_ON_SHADED_BOUNDS = 2.4
const OVERLAY_CONTRAST = 3
/**
 * Known exception: on a photo epic reaches 2.6:1 on a reservoir and 2.0:1 on the sea, and the navy casing cannot lift a
 * line off dark water. An overlay road runs on land with water at most on one side; the route, with its white band,
 * holds there.
 */
const WATER_SAMPLES: string[] = [PHOTO_SAMPLES.reservoir, PHOTO_SAMPLES.sea]
const OVERLAY_EXEMPT_SURFACES = WATER_SAMPLES
/** At the Spain view the overlay casing is faded in only partly; amber, the faintest rating, must still hold on bleached cereal. */
const SPAIN_VIEW_SURFACE = PHOTO_SAMPLES.cereal
const MIN_RATING_DELTA_E = 10
const MIN_ROAD_DELTA_E = 15

/** Over a photo the route is read on the photo, and on the dark fills wherever it has not loaded. */
const fillsOf = (look: MapLook) => [
  look.colors.land,
  look.colors.wood,
  look.colors.grass,
  look.colors.urban,
  ...(look.hidden.some((layer) => IMAGERY_LAYERS.includes(layer as never)) ? [] : Object.values(PHOTO_SAMPLES)),
]

/**
 * How dark the hillshade can make the land: its shadow, and its shadow and accent together, laid on at full strength
 * over the land and the woods. No tile gets there (a render of the light map at z10.5 over the Pyrenees has its darkest
 * land, p5, at L* 84), so these are bounds: darker than anything the rider will see.
 */
function shadedBoundsOf(look: MapLook): string[] {
  if (look.hidden.includes('hillshade')) return []
  const { land, wood } = look.colors
  const { shadow, accent } = look.hillshade
  return [land, wood].flatMap((fill) => [over(shadow, 1, fill), over(accent, 1, over(shadow, 1, fill))])
}

/** The bands of a twisty stretch from the outside in, as they look over a surface: the outer edge, the rim, the colour. */
function twistyBands(look: MapLook, rating: number, surface: string): string[] {
  const { glow, casing } = look.route.twisty
  const bands: string[] = []
  let under = surface
  for (const { color, opacity } of [...(glow.color ? [{ color: glow.color, opacity: glow.opacity }] : []), casing]) {
    under = over(color, opacity, under)
    bands.push(under)
  }
  return [...bands, look.ramp[rating]]
}

describe('themes', () => {
  it('parses a stored choice and falls back to dark', () => {
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('dark')).toBe('dark')
    for (const odd of [null, undefined, '', 'sepia', 3]) expect(parseTheme(odd)).toBe(DEFAULT_THEME)
    expect(DEFAULT_THEME).toBe('dark')
  })

  it('keeps the dark theme as it was before themes existed, with the base roads and water raised for sunlight', () => {
    expect(LOOKS.dark.colors).toBe(MAP_COLORS)
    expect(MAP_COLORS).toMatchObject({ background: '#07090d', land: '#0b0e14', wood: '#0b1411', motorway: '#465374', label: '#7d869a', halo: '#07090d' })
    expect(RATING_COLORS).toEqual(['#5b95f2', '#1fc8d8', '#ffd166', '#ff8a3d', '#ff2e6e'])
    expect(LOOKS.dark.route.transit).toMatchObject({ color: '#e6ebf5', width: 3.2, opacity: 0.85, casingColor: '#000000', casingOpacity: 0.55 })
    expect(LOOKS.dark.route.track.color).toBe('#d2a86e')
    expect(LOOKS.dark.overlay.glow).toMatchObject({ color: null, opacity: 0.28, dimmedOpacity: 0.05, fadeIn: null })
    expect(LOOKS.dark.overlay.dimmedFadeOut).toBeNull()
    expect(mapStyle()).toEqual(mapStyle('dark'))
  })

  it('has a look for every theme', () => {
    expect(Object.keys(LOOKS).sort()).toEqual([...MAP_THEMES].sort())
  })

  it('changes the same properties going to light and coming back, so a theme leaves nothing behind', () => {
    expect(themeChanges('dark', 'dark')).toEqual([])
    const keys = (from: MapTheme, to: MapTheme) =>
      themeChanges(from, to)
        .map(({ layer, property }) => `${layer}/${property}`)
        .sort()
    expect(keys('dark', 'light').length).toBeGreaterThan(40)
    for (const [a, b] of [['dark', 'light'], ['dark', 'satellite'], ['light', 'satellite']] as const) expect(keys(b, a)).toEqual(keys(a, b))
  })

  it('puts a property a theme does not set back to its default', () => {
    const toDark = themeChanges('satellite', 'dark')
    expect(toDark).toContainEqual({ layer: 'road-primary', property: 'line-opacity', value: undefined })
    expect(toDark).toContainEqual({ layer: 'hillshade', property: 'visibility', value: undefined })
    expect(toDark).toContainEqual({ layer: 'imagery-pnoa', property: 'visibility', value: 'none' })
  })

  it('dims the overlay by the theme, and the light casing stays off at the Spain view', () => {
    expect(overlayOpacity('dark', true)).toEqual({ glow: 0.05, line: 0.2 })
    expect(overlayOpacity('light', true)).toEqual({ glow: ['interpolate', ['linear'], ['zoom'], 6, 0, 9, 0.1], line: 0.4 })
    expect(overlayOpacity('light', false).glow).toEqual(['interpolate', ['linear'], ['zoom'], 6, 0, 9, 0.8])
    expect(overlayLayers(undefined, 'light')[0].paint?.['line-color']).toBe('#1b2335')
  })
})

describe.each(MAP_THEMES)('legibility on the %s map', (theme) => {
  const look = LOOKS[theme]
  const fills = fillsOf(look)
  const bounds = shadedBoundsOf(look)
  const surfaces = (onBounds: number) => [...fills.map((surface) => ({ surface, floor: ROUTE_CONTRAST_ON_FILLS })), ...bounds.map((surface) => ({ surface, floor: onBounds }))]

  it('shows a twisty stretch band by band: every neighbour apart for every vision, the strongest band clear of the surface', () => {
    for (const { surface, floor } of surfaces(CONTRAST_ON_SHADED_BOUNDS)) {
      for (let rating = 0; rating < 5; rating++) {
        const bands = twistyBands(look, rating, surface)
        for (let i = 0; i < bands.length - 1; i++) expect(apart(bands[i], bands[i + 1]), `${bands} on ${surface}`).toBe(true)
        expect(Math.max(...bands.map((band) => contrast(band, surface))), `${bands} on ${surface}`).toBeGreaterThanOrEqual(floor)
      }
    }
  })

  it('shows the transit and track lines against their casing and the surface', () => {
    for (const { surface, floor } of surfaces(TRANSIT_CONTRAST_ON_SHADED_BOUNDS)) {
      for (const line of [look.route.transit, look.route.track]) {
        // Known exception, like the overlay's: the tan track reaches 4.3:1 on a reservoir and less on the sea, where its
        // dark casing cannot help. A shore track has land on its other side; the transit leg holds on water.
        if (line === look.route.track && WATER_SAMPLES.includes(surface)) continue
        // A blurred casing counts as half its opacity at the edge.
        const casing = over(line.casingColor, line.casingOpacity * (line.casingBlur > 0 ? 0.5 : 1), surface)
        const own = over(line.color, line.opacity, casing)
        expect(apart(own, casing), `${own} in ${casing} on ${surface}`).toBe(true)
        expect(Math.max(contrast(own, surface), contrast(casing, surface)), `${own} in ${casing} on ${surface}`).toBeGreaterThanOrEqual(floor)
      }
    }
  })

  it('shows the overlay at 3:1 on every surface from zoom 9', () => {
    const { glow } = look.overlay
    for (const surface of [...fills, ...bounds].filter((surface) => !OVERLAY_EXEMPT_SURFACES.includes(surface))) {
      const casing = glow.color ? over(glow.color, glow.opacity, surface) : null
      for (const color of look.ramp) {
        expect(Math.max(contrast(color, surface), casing ? contrast(casing, surface) : 0)).toBeGreaterThanOrEqual(OVERLAY_CONTRAST)
        // Known exception: epic merges with the navy casing for a protanope (dE 8.5), and a third band on every overlay
        // line is not worth its cost. It still reads as a dark line, and the route, which carries a white rim, does not.
        if (casing) expect(apartInNormalVision(color, casing)).toBe(true)
      }
    }
  })

  it('tells neighbouring ratings apart for every kind of colour vision', () => {
    for (const vision of visions) {
      for (let i = 0; i < 4; i++) expect(deltaE(look.ramp[i], look.ramp[i + 1], vision)).toBeGreaterThanOrEqual(MIN_RATING_DELTA_E)
    }
  })

  // A translucent line takes on the ground under it, which can merge two ratings that are apart on their own.
  it('tells neighbouring ratings apart as every translucent line draws them on every surface', () => {
    const twisty = routeLayers(theme).find((layer) => layer.id === 'route-twisty')?.paint?.['line-opacity'] as number
    for (const opacity of [look.overlay.line.opacity, twisty].filter((opacity) => opacity < 1)) {
      for (const surface of [...fills, ...bounds]) {
        const ramp = look.ramp.map((color) => over(color, opacity, surface))
        for (const vision of visions) {
          for (let i = 0; i < 4; i++) expect(deltaE(ramp[i], ramp[i + 1], vision), `${opacity} on ${surface}, ${vision}`).toBeGreaterThanOrEqual(MIN_RATING_DELTA_E)
        }
      }
    }
  })

  it('keeps every road colour clear of every rating for every kind of colour vision', () => {
    for (const road of [look.colors.motorway, look.colors.primary, look.colors.secondary, look.colors.minor]) {
      for (const color of look.ramp) {
        for (const vision of visions) expect(deltaE(road, color, vision)).toBeGreaterThanOrEqual(MIN_ROAD_DELTA_E)
      }
    }
  })

  it('can dim every layer of the route while a new one is planned', () => {
    const dimmed = routeLayers(theme, 0.5)
    routeLayers(theme).forEach((layer, i) => {
      const opacity = layer.paint?.['line-opacity']
      expect(opacity).toBeDefined()
      if (opacity !== 0) expect(dimmed[i].paint?.['line-opacity']).not.toEqual(opacity)
    })
  })
})

describe('the dark map', () => {
  it('shows the dark base roads in sunlight, the bigger the road the clearer', () => {
    const { land, motorway, primary, secondary, minor } = MAP_COLORS
    const steps = [motorway, primary, secondary, minor].map((road) => contrast(road, land))
    expect(steps).toEqual([...steps].sort((a, b) => b - a))
    expect(steps[0]).toBeGreaterThanOrEqual(2.5)
    expect(steps[1]).toBeGreaterThanOrEqual(1.9)
    expect(steps[3]).toBeGreaterThanOrEqual(1.2)
  })

  it('tells dark water from land by hue, not only lightness', () => {
    expect(deltaE(MAP_COLORS.water, MAP_COLORS.land)).toBeGreaterThanOrEqual(MIN_WATER_DELTA_E)
  })
})

describe('the light map', () => {
  const look = LOOKS.light

  // The bounds in `shadedBoundsOf` and the render they were checked against hold for this hillshade only.
  it('keeps the hillshade the light bounds were measured with', () => {
    expect(look.hillshade).toEqual({
      exaggeration: 0.25,
      shadow: 'rgba(74, 64, 50, 0.35)',
      highlight: 'rgba(255, 255, 255, 0.5)',
      accent: 'rgba(74, 64, 50, 0.2)',
    })
  })

  it('has a deeper ramp than the sheet, of the same hue families', () => {
    look.ramp.forEach((color, i) => {
      expect(lightness(color)).toBeLessThan(lightness(RATING_COLORS[i]))
      const apartInHue = Math.abs(((hue(color) - hue(RATING_COLORS[i]) + 540) % 360) - 180)
      expect(apartInHue).toBeLessThanOrEqual(30)
    })
  })

  it('keeps the rivers fainter than the secondary roads, or the rider reads water first', () => {
    const { land, waterLine, secondary } = look.colors
    expect(contrast(waterLine, land)).toBeLessThan(contrast(secondary, land))
  })
})

describe('zoomedOpacity', () => {
  it('rises from a share of the opacity and falls to nothing', () => {
    expect(zoomedOpacity(0.5, null, null)).toBe(0.5)
    expect(zoomedOpacity(0.8, { zooms: [5, 8], share: 0.5 }, null)).toEqual(['interpolate', ['linear'], ['zoom'], 5, 0.4, 8, 0.8])
    expect(zoomedOpacity(0.4, null, [13.5, 14])).toEqual(['interpolate', ['linear'], ['zoom'], 13.5, 0.4, 14, 0])
    expect(zoomedOpacity(0.1, { zooms: [5, 8], share: 0.5 }, [13.5, 14])).toEqual(['interpolate', ['linear'], ['zoom'], 5, 0.05, 8, 0.1, 13.5, 0.1, 14, 0])
  })
})

describe('the satellite map', () => {
  const style = (theme: MapTheme) => new Map(mapStyle(theme).layers.map((layer) => [layer.id, layer]))
  const drawn = (theme: MapTheme, id: string) => style(theme).get(id)?.layout?.visibility !== 'none'

  it('draws the photo only in the satellite theme, without the hillshade and the minor roads', () => {
    for (const layer of IMAGERY_LAYERS) {
      expect(drawn('dark', layer)).toBe(false)
      expect(drawn('light', layer)).toBe(false)
      expect(drawn('satellite', layer)).toBe(true)
    }
    for (const layer of ['hillshade', 'road-minor']) {
      expect(drawn('satellite', layer)).toBe(false)
      expect(drawn('dark', layer)).toBe(true)
    }
  })

  // Changing the photo would make it a derived work, which its licence credits differently.
  it('shows the photo unmodified', () => {
    for (const theme of MAP_THEMES) {
      for (const layer of IMAGERY_LAYERS) expect(Object.keys(style(theme).get(layer)?.paint ?? {})).toEqual(['raster-fade-duration'])
    }
  })

  it('lays the photo over the fills, so they show only where it has not loaded', () => {
    const order = mapStyle('satellite').layers.map((layer) => layer.id)
    for (const fill of ['landcover-wood', 'landcover-grass', 'landuse-urban', 'water', 'waterway']) {
      for (const layer of IMAGERY_LAYERS) expect(order.indexOf(fill)).toBeLessThan(order.indexOf(layer))
    }
    expect(order.indexOf(IMAGERY_LAYERS[1])).toBeLessThan(order.indexOf('road-primary'))
  })

  it('keeps the bright ramp of the sheet', () => {
    expect(LOOKS.satellite.ramp).toBe(RATING_COLORS)
  })

  it('keeps every rating at 3:1 on bleached cereal at the Spain view, with the casing only partly faded in', () => {
    const { glow } = LOOKS.satellite.overlay
    const casing = over(glow.color!, glow.opacity * glow.fadeIn!.share, SPAIN_VIEW_SURFACE)
    for (const color of LOOKS.satellite.ramp) {
      expect(Math.max(contrast(color, SPAIN_VIEW_SURFACE), contrast(casing, SPAIN_VIEW_SURFACE))).toBeGreaterThanOrEqual(OVERLAY_CONTRAST)
    }
  })

  // Until the route draws the twisty's own geometry, the overlay beside it shows the same road twice at close zoom.
  it('lets the stepped-back overlay go before the close zooms', () => {
    expect(JSON.stringify(overlayOpacity('satellite', true).line)).toBe(JSON.stringify(['interpolate', ['linear'], ['zoom'], 13.5, 0.4, 14, 0]))
    expect(overlayOpacity('satellite', false).line).toBe(1)
  })
})

describe('applyTheme', () => {
  it('sets only what differs, only on layers the map has, and the sky', () => {
    const present = new Set(['background', 'hillshade', 'twisties-glow', 'route-twisty', 'route-twisty-moving', 'route-badges'])
    const set: string[] = []
    let sky: unknown
    const map = {
      getLayer: (id: string) => (present.has(id) ? {} : undefined),
      setPaintProperty: (id: string, property: string) => set.push(`${id}/${property}`),
      setLayoutProperty: (id: string, property: string) => set.push(`${id}/${property}`),
      setSky: (value: unknown) => (sky = value),
    }
    applyTheme(map as never, 'dark', 'light')
    expect(set).toContain('background/background-color')
    expect(set).toContain('twisties-glow/line-color')
    expect(set).toContain('route-twisty-moving/line-color')
    expect(set).toContain('route-badges/icon-halo-color')
    expect(set.every((entry) => present.has(entry.split('/')[0]))).toBe(true)
    expect(sky).toBe(LOOKS.light.sky)

    set.length = 0
    applyTheme(map as never, 'light', 'light')
    expect(set).toEqual([])

    applyTheme(map as never, 'light', 'satellite')
    expect(set).toContain('hillshade/visibility')
  })
})
