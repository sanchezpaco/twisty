import type { LonLat } from '../geo'

/** The two regions the map frames on its own: mainland Spain with the Balearics, and the Canary Islands. */
export type Region = 'mainland' | 'canaries'

export const SPAIN_BOUNDS: [LonLat, LonLat] = [
  [-9.6, 35.6],
  [4.4, 43.9],
]
export const CANARIES_BOUNDS: [LonLat, LonLat] = [
  [-18.2, 27.6],
  [-13.3, 29.5],
]
export const REGION_BOUNDS: Record<Region, [LonLat, LonLat]> = { mainland: SPAIN_BOUNDS, canaries: CANARIES_BOUNDS }
/** Halfway across the sea between the islands' north coast and Andalusia's south. */
const CANARIES_NORTH_LAT = 33

export function regionAt([, lat]: LonLat): Region {
  return lat < CANARIES_NORTH_LAT ? 'canaries' : 'mainland'
}
