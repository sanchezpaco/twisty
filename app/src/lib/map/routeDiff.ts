import type { LonLat } from '../geo'
import type { RouteSegment } from '../routing/ride'

export interface RouteDiff {
  /** Number of leading points both lines share: the lines split after index `prefixEnd - 1`. */
  prefixEnd: number
  /** Where the points both lines share to the end begin, in each line. They never overlap the prefix. */
  oldSuffixStart: number
  newSuffixStart: number
}

const samePoint = (a: LonLat, b: LonLat) => a[0] === b[0] && a[1] === b[1]

/** Exact equality is enough: both lines are built from the same graph, so shared roads repeat the same coordinates. */
export function routeDiff(oldLine: LonLat[], newLine: LonLat[]): RouteDiff {
  const shortest = Math.min(oldLine.length, newLine.length)
  let prefixEnd = 0
  while (prefixEnd < shortest && samePoint(oldLine[prefixEnd], newLine[prefixEnd])) prefixEnd++

  const room = shortest - prefixEnd
  let suffixLength = 0
  while (
    suffixLength < room &&
    samePoint(oldLine[oldLine.length - 1 - suffixLength], newLine[newLine.length - 1 - suffixLength])
  ) {
    suffixLength++
  }
  return {
    prefixEnd,
    oldSuffixStart: oldLine.length - suffixLength,
    newSuffixStart: newLine.length - suffixLength,
  }
}

/** A ride's points in riding order; neighbouring segments share the point where they meet. */
export function routeLine(segments: RouteSegment[]): LonLat[] {
  return segments.flatMap((segment) => segment.line)
}

/** The part of a ride between two indices of its `routeLine`, both included, still split into its segments. */
export function sliceSegments(segments: RouteSegment[], firstIndex: number, lastIndex: number): RouteSegment[] {
  const pieces: RouteSegment[] = []
  let offset = 0
  for (const segment of segments) {
    const first = Math.max(firstIndex - offset, 0)
    const last = Math.min(lastIndex - offset, segment.line.length - 1)
    if (last > first) pieces.push({ ...segment, line: segment.line.slice(first, last + 1) })
    offset += segment.line.length
  }
  return pieces
}
