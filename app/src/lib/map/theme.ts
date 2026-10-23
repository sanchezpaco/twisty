import type { SkySpecification } from 'maplibre-gl'

/** What the rider can pick for the map. The sheet and the pills stay dark in every theme. */
export type MapTheme = 'dark' | 'light' | 'satellite'
export const MAP_THEMES: readonly MapTheme[] = ['dark', 'light', 'satellite']
export const DEFAULT_THEME: MapTheme = 'dark'

export function parseTheme(raw: unknown): MapTheme {
  return MAP_THEMES.find((theme) => theme === raw) ?? DEFAULT_THEME
}

/** Heat ramp from flowing (cool) to epic (hot); index = rating - 1. */
export type Ramp = readonly [string, string, string, string, string]

/** The dark ramp is also the sheet's: its coloured text needs the bright colours on dark chrome. */
export const RATING_COLORS: Ramp = ['#5b95f2', '#1fc8d8', '#ffd166', '#ff8a3d', '#ff2e6e']
/** The same hue families, deeper, so a line stays visible on a light map and still darkens towards epic. */
export const LIGHT_RATING_COLORS: Ramp = ['#3a6fe0', '#0e98a8', '#d9a000', '#cf4a10', '#a8125f']

export interface MapColors {
  background: string
  land: string
  wood: string
  grass: string
  urban: string
  water: string
  waterLine: string
  motorway: string
  primary: string
  secondary: string
  minor: string
  border: string
  label: string
  labelStrong: string
  peak: string
  halo: string
}

/**
 * Night palette: the base map stays quiet so the twisties and the route can glow, yet a road network the rider can
 * follow in sunlight. Roads step down in neutral grey, clear of every rating; water is told from land by its navy hue.
 */
export const MAP_COLORS: MapColors = {
  background: '#07090d',
  land: '#0b0e14',
  wood: '#0b1411',
  grass: '#0d1312',
  urban: '#121620',
  water: '#0a1a30',
  waterLine: '#1a3352',
  motorway: '#465374',
  primary: '#3a4358',
  secondary: '#2b3243',
  minor: '#1f2532',
  border: '#3a4257',
  label: '#7d869a',
  labelStrong: '#c9d0de',
  peak: '#5d6679',
  halo: '#07090d',
}

/**
 * Paper palette. Roads are warm neutrals without casing: an orange motorway would read as a twisty, and a cool grey is
 * what a protanope confuses with the teal rating. They stay darker than the rivers, or the rider reads water first.
 */
export const LIGHT_MAP_COLORS: MapColors = {
  background: '#f2efe9',
  land: '#f2efe9',
  wood: '#d4e2c6',
  grass: '#e6ecd9',
  urban: '#e4e0d8',
  water: '#b5d3e7',
  waterLine: '#a6c6e0',
  motorway: '#a9a6a0',
  primary: '#b5b2ac',
  secondary: '#c4c1bb',
  minor: '#c9c6bf',
  border: '#9a94a6',
  label: '#4a5266',
  labelStrong: '#1f2533',
  peak: '#6b6455',
  halo: '#f2efe9',
}

/**
 * What an orthophoto of Spain shows under a line, from the brightest to the darkest: snow, bleached cereal, olive
 * groves, forest, deep forest, a reservoir and the sea by a coast road. The satellite look is measured on these, and its thumbnail drawn with them.
 */
export const PHOTO_SAMPLES = {
  snow: '#f2f3f0',
  cereal: '#d8c6a0',
  olive: '#8f8a66',
  forest: '#2c3a26',
  deepForest: '#18211a',
  reservoir: '#2b4a5a',
  sea: '#3d5a6e',
} as const

/** A road seen from the air, for the picker's drawing of the satellite view. */
const ASPHALT = '#5c5d5a'

/**
 * Under the photo while it loads, or where it fails: a dark map with the route, never holes. The fills are drawn under
 * the photo, which covers them tile by tile as it fades in.
 */
export const SATELLITE_MAP_COLORS: MapColors = {
  background: '#1c211c',
  land: '#1c211c',
  wood: '#18201a',
  grass: '#1e241d',
  urban: '#25282a',
  water: '#121b22',
  waterLine: '#1d2b36',
  motorway: '#ffffff',
  primary: '#ffffff',
  secondary: '#ffffff',
  minor: '#ffffff',
  border: '#d8dce6',
  label: '#ffffff',
  labelStrong: '#ffffff',
  peak: '#e6e9ef',
  halo: 'rgba(0, 0, 0, 0.65)',
}

/** A line of the route with the casing that lifts it off the map. */
export interface RouteLine {
  color: string
  width: number
  opacity: number
  casingColor: string
  casingOpacity: number
  casingBlur: number
  casingWidth: number
}

export interface MapLook {
  colors: MapColors
  ramp: Ramp
  sky: SkySpecification
  hillshade: { exaggeration: number; shadow: string; highlight: string; accent: string }
  /** Layers of the style this theme does not draw. */
  hidden: readonly string[]
  /** Peak names go under the route instead of over it, where a busy ground already competes with the line. */
  peaksUnderRoute: boolean
  /** Softens the label halos; 0 keeps them crisp. */
  labelHaloBlur: number
  /**
   * Roads drawn faintly over a photo, only where it is too coarse to show them, gone by `goneBy`; `null` draws the roads
   * of the vector map.
   */
  photoRoads: { opacity: number; width: [number, number]; zooms: [number, number]; goneBy: number } | null
  /** The thumbnail of the style picker: a hairpin drawn on this ground. */
  thumbnail: { land: string; wood: string; field: string; water: string; road: string }
  overlay: {
    /** The glow layer of the Spain-wide overlay; on a light map it is the casing instead. `null` colour = the ramp. */
    glow: {
      color: string | null
      width: [number, number]
      blur: [number, number]
      opacity: number
      dimmedOpacity: number
      /** Rises from `share` of its opacity at the first zoom to all of it at the second; `null` keeps it at every zoom. */
      fadeIn: { zooms: [number, number]; share: number } | null
    }
    line: { opacity: number; dimmedOpacity: number }
    /** Stepped back behind a ride, the overlay is gone between these zooms; `null` keeps it at every zoom. */
    dimmedFadeOut: [number, number] | null
  }
  route: {
    ghostColor: string
    transit: RouteLine
    track: RouteLine
    twisty: {
      width: number
      haloOpacity: number
      /** `null` colour = the ramp; on a light map the glow is a white band outside the casing. */
      glow: { color: string | null; width: number; opacity: number }
      casing: { color: string; width: number; opacity: number }
    }
  }
}

const NAVY = '#1b2335'
const MAP_TRACK_COLOR = '#d2a86e'
/** The orthophoto layers, one per credit (see `style.ts`); only the satellite theme draws them. */
export const IMAGERY_LAYERS = ['imagery-sentinel', 'imagery-pnoa'] as const
/** The transit leg of a light route: lighter than the navy of the twisty sections, so the curves lead. */
const SLATE = '#4a5468'

export const LOOKS: Record<MapTheme, MapLook> = {
  dark: {
    colors: MAP_COLORS,
    ramp: RATING_COLORS,
    sky: {
      'sky-color': '#0a0e17',
      'horizon-color': '#1b2335',
      'fog-color': MAP_COLORS.background,
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.3,
      'atmosphere-blend': 0.4,
    },
    hillshade: { exaggeration: 0.55, shadow: '#000000', highlight: 'rgba(150, 170, 210, 0.22)', accent: '#000000' },
    hidden: IMAGERY_LAYERS,
    peaksUnderRoute: false,
    labelHaloBlur: 0,
    photoRoads: null,
    thumbnail: { land: MAP_COLORS.land, wood: MAP_COLORS.wood, field: MAP_COLORS.land, water: MAP_COLORS.water, road: MAP_COLORS.primary },
    overlay: {
      glow: { color: null, width: [4, 16], blur: [3, 10], opacity: 0.28, dimmedOpacity: 0.05, fadeIn: null },
      line: { opacity: 0.9, dimmedOpacity: 0.2 },
      dimmedFadeOut: null,
    },
    route: {
      ghostColor: '#e6ebf5',
      transit: { color: '#e6ebf5', width: 3.2, opacity: 0.85, casingColor: '#000000', casingOpacity: 0.55, casingBlur: 2, casingWidth: 8 },
      track: { color: MAP_TRACK_COLOR, width: 3.6, opacity: 1, casingColor: '#000000', casingOpacity: 0.55, casingBlur: 2, casingWidth: 8 },
      twisty: {
        width: 6,
        haloOpacity: 0.1,
        glow: { color: null, width: 14, opacity: 0.22 },
        casing: { color: '#07090d', width: 9, opacity: 0.8 },
      },
    },
  },
  light: {
    colors: LIGHT_MAP_COLORS,
    ramp: LIGHT_RATING_COLORS,
    sky: {
      'sky-color': '#cfe0f2',
      'horizon-color': '#e6eef7',
      'fog-color': LIGHT_MAP_COLORS.background,
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.3,
      'atmosphere-blend': 0.4,
    },
    // Gentle on purpose: a stronger shadow darkens north-facing slopes, where the twisties are, until the deep ramp loses
    // its contrast. The route test checks the ramp over the shadow laid on at full strength, and pins these values: when
    // they change, measure a render again (z8, z10.5 and z12 over the Pyrenees and Cazorla) and revisit the bounds there.
    hillshade: { exaggeration: 0.25, shadow: 'rgba(74, 64, 50, 0.35)', highlight: 'rgba(255, 255, 255, 0.5)', accent: 'rgba(74, 64, 50, 0.2)' },
    hidden: IMAGERY_LAYERS,
    peaksUnderRoute: false,
    labelHaloBlur: 0,
    photoRoads: null,
    thumbnail: { land: LIGHT_MAP_COLORS.land, wood: LIGHT_MAP_COLORS.wood, field: LIGHT_MAP_COLORS.land, water: LIGHT_MAP_COLORS.water, road: LIGHT_MAP_COLORS.primary },
    overlay: {
      // Off at the Spain view, so thousands of cased lines do not become a dark scribble over the paper.
      glow: { color: NAVY, width: [2.2, 5.6], blur: [0, 0], opacity: 0.8, dimmedOpacity: 0.1, fadeIn: { zooms: [6, 9], share: 0 } },
      // Opaque: at 0.9 the wood under it brings two ratings closer than a tritanope can tell. Stepped back a ride's overlay
      // stays a coloured line; at 0.2 the ramp turned to mud under its casing.
      line: { opacity: 1, dimmedOpacity: 0.4 },
      dimmedFadeOut: null,
    },
    route: {
      ghostColor: SLATE,
      transit: { color: SLATE, width: 3.5, opacity: 1, casingColor: '#ffffff', casingOpacity: 0.9, casingBlur: 0, casingWidth: 8 },
      track: { color: SLATE, width: 3.5, opacity: 1, casingColor: '#ffffff', casingOpacity: 0.9, casingBlur: 0, casingWidth: 8 },
      // From the outside in: a navy edge, a white rim, the ramp. A magenta line inside a navy casing disappears into it
      // for a protanope, whatever the colours; with the white rim between them every rating stands out in every vision.
      twisty: {
        width: 6,
        haloOpacity: 0,
        glow: { color: NAVY, width: 11, opacity: 0.95 },
        casing: { color: '#ffffff', width: 8, opacity: 1 },
      },
    },
  },
  satellite: {
    colors: SATELLITE_MAP_COLORS,
    ramp: RATING_COLORS,
    // A hazy dusk over the photo in 3D, not the night of the dark map.
    sky: {
      'sky-color': '#36507a',
      'horizon-color': '#a9b8cc',
      'fog-color': '#7d8ca0',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.3,
      'atmosphere-blend': 0.4,
    },
    // The photo has its own light and shade; the hillshade on top would only muddy it.
    hillshade: { exaggeration: 0, shadow: '#000000', highlight: '#000000', accent: '#000000' },
    hidden: ['hillshade', 'road-minor'],
    peaksUnderRoute: true,
    labelHaloBlur: 0.8,
    // Below zoom 13 the photo is 10 m Sentinel or a coarse orthophoto, and a road is a guess; from there it shows itself.
    photoRoads: { opacity: 0.35, width: [0.5, 1.5], zooms: [7, 13], goneBy: 14 },
    // Drawn, not cropped from a tile: an IGN crop in the picker would need a credit of its own.
    thumbnail: { land: PHOTO_SAMPLES.olive, wood: PHOTO_SAMPLES.forest, field: PHOTO_SAMPLES.cereal, water: PHOTO_SAMPLES.reservoir, road: ASPHALT },
    overlay: {
      // Lighter and thinner at the Spain view, where thousands of cased lines turn to confetti; 0.56 is the least that
      // keeps amber at 3:1 on bleached cereal.
      glow: { color: NAVY, width: [1.6, 5.6], blur: [0, 0], opacity: 0.8, dimmedOpacity: 0.1, fadeIn: { zooms: [5, 8], share: 0.7 } },
      line: { opacity: 1, dimmedOpacity: 0.4 },
      // Until the route draws the twisty's own geometry (ROADMAP Next up 21), it runs up to 15 m off the road, and from
      // zoom 14 the stepped-back overlay would show the same twisty a line apart from it.
      dimmedFadeOut: [13.5, 14],
    },
    route: {
      ghostColor: '#ffffff',
      // Unblurred: a blurred rim is half as dark at its edge, and on snow that edge is all that tells the line apart.
      transit: { color: '#ffffff', width: 4, opacity: 1, casingColor: '#000000', casingOpacity: 0.85, casingBlur: 0, casingWidth: 7 },
      // The tan of the dark map and of the sheet's tracks line: white dashes merged with the transit legs.
      track: { color: MAP_TRACK_COLOR, width: 3.6, opacity: 1, casingColor: '#000000', casingOpacity: 0.85, casingBlur: 0, casingWidth: 7 },
      // From the outside in: a white band, a dark rim, the ramp. The white band holds the line on dark forest, the rim
      // on snow and bleached fields.
      twisty: {
        width: 5,
        haloOpacity: 0,
        glow: { color: '#ffffff', width: 12, opacity: 0.9 },
        casing: { color: '#000000', width: 8, opacity: 0.9 },
      },
    },
  },
}
