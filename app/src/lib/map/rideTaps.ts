import { BADGE_LAYER } from './layers'

/** The layers a tap on the ride is read from: the numbered badges, and the twisties' glow, the widest of their lines. */
export const RIDE_TAP_LAYERS = [BADGE_LAYER, 'route-twisty-glow']

interface TappedFeature {
  layer: { id: string }
  properties: Record<string, unknown>
}

/**
 * The number of the twisty a tap on the ride landed on, as its badge and its row show it, or null. A badge wins over the
 * lines under it, since it is what the rider aims at.
 */
export function tappedTwisty(features: TappedFeature[]): number | null {
  const badge = features.find((feature) => feature.layer.id === BADGE_LAYER)
  const number = badge ? badge.properties.index : features.find((feature) => typeof feature.properties.twisty === 'number')?.properties.twisty
  return typeof number === 'number' ? number : null
}
