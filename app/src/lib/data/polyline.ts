import type { LonLat } from '../geo'

const PRECISION = 1e5

/** Decodes Google's encoded polyline format (stores lat, lon pairs) into [lon, lat] points. */
export function decodePolyline(encoded: string): LonLat[] {
  const points: LonLat[] = []
  let index = 0
  let lat = 0
  let lon = 0
  const next = () => {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }
  while (index < encoded.length) {
    lat += next()
    lon += next()
    points.push([lon / PRECISION, lat / PRECISION])
  }
  return points
}
