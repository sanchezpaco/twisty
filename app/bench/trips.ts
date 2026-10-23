import { readFileSync } from 'node:fs'
import type { LonLat } from '../src/lib/geo'

/** One trip of `trips.json`: where it goes, how it is planned and which set it belongs to. */
export interface BenchTrip {
  id: string
  kind: string
  set: 'tuning' | 'holdout'
  from: LonLat
  to: LonLat
  includeTracks: boolean
  fromName?: string
  toName?: string
  tags?: string[]
  note?: string
  /** A real-world time for the fastest option, from the rider's own recorded rides (R11). */
  referenceTimeS?: number
  /** Known roads this trip is the scout's trip for. */
  roads?: string[]
}

export function readTrips(path: string): BenchTrip[] {
  const { trips } = JSON.parse(readFileSync(path, 'utf8')) as { trips: BenchTrip[] }
  const ids = new Set<string>()
  for (const trip of trips) {
    if (ids.has(trip.id)) throw new Error(`Trip ${trip.id} is listed twice in ${path}`)
    ids.add(trip.id)
  }
  return trips
}
