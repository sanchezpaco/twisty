export type LonLat = [lon: number, lat: number]

const EARTH_RADIUS_M = 6_371_000
/** Metres along a meridian per degree of latitude. */
export const METRES_PER_DEGREE = (EARTH_RADIUS_M * Math.PI) / 180

export function haversineM([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLon = (lon2 - lon1) * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function cumulativeDistancesM(line: LonLat[]): number[] {
  const distances = [0]
  for (let i = 1; i < line.length; i++) distances.push(distances[i - 1] + haversineM(line[i - 1], line[i]))
  return distances
}

/** Point at `distanceM` along the line, clamped to its ends. */
export function pointAlong(line: LonLat[], distanceM: number, cumulative = cumulativeDistancesM(line)): LonLat {
  if (distanceM <= 0) return line[0]
  for (let i = 1; i < line.length; i++) {
    if (cumulative[i] >= distanceM) {
      const t = (distanceM - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1] || 1)
      const [a, b] = [line[i - 1], line[i]]
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    }
  }
  return line[line.length - 1]
}

export function isLonLat(value: unknown): value is LonLat {
  if (!Array.isArray(value) || value.length !== 2) return false
  const [lon, lat] = value
  return Number.isFinite(lon) && Math.abs(lon) <= 180 && Number.isFinite(lat) && Math.abs(lat) <= 90
}
