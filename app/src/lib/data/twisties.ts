import type { LonLat } from '../geo'
import { decodePolyline } from './polyline'

/** A long curvy stretch of road, shown in the Spain-wide overview. */
export interface Twisty {
  id: number
  name: string | null
  ref: string | null
  lengthM: number
  /** Heading change in degrees per km. */
  twist: number
  /** 1 (flowing) to 5 (epic). */
  rating: number
  line: LonLat[]
}

interface TwistyRecord extends Omit<Twisty, 'line'> {
  line: string
}

export function parseTwisties(json: { twisties: TwistyRecord[] }): Twisty[] {
  return json.twisties.map((record) => ({ ...record, line: decodePolyline(record.line) }))
}
