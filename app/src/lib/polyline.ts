import type { LonLat } from './geo'

/** Steps of a millionth of a degree, about 0.1 m: the precision a GPX file is written with. */
const PRECISION = 1e6

/**
 * A line as an encoded polyline (Google's format, latitude first, at `PRECISION`): a saved ride keeps its lines in about
 * a tenth of the room plain JSON takes.
 */
export function encodeLine(line: LonLat[]): string {
  let text = ''
  let previousLat = 0
  let previousLon = 0
  for (const [lon, lat] of line) {
    const scaledLat = Math.round(lat * PRECISION)
    const scaledLon = Math.round(lon * PRECISION)
    text += encodeNumber(scaledLat - previousLat) + encodeNumber(scaledLon - previousLon)
    previousLat = scaledLat
    previousLon = scaledLon
  }
  return text
}

/** The line `encodeLine` wrote; throws on text it could not have written. */
export function decodeLine(text: string): LonLat[] {
  const line: LonLat[] = []
  let index = 0
  let lat = 0
  let lon = 0
  const next = () => {
    let result = 0
    let shift = 0
    let chunk: number
    do {
      if (index >= text.length) throw new Error('Truncated polyline')
      chunk = text.charCodeAt(index++) - 63
      if (chunk < 0 || chunk > 63) throw new Error('Not a polyline')
      result |= (chunk & 0x1f) << shift
      shift += 5
    } while (chunk >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }
  while (index < text.length) {
    lat += next()
    lon += next()
    line.push([lon / PRECISION, lat / PRECISION])
  }
  return line
}

function encodeNumber(value: number): string {
  let rest = value < 0 ? ~(value << 1) : value << 1
  let text = ''
  while (rest >= 0x20) {
    text += String.fromCharCode((0x20 | (rest & 0x1f)) + 63)
    rest >>= 5
  }
  return text + String.fromCharCode(rest + 63)
}
