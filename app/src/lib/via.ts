import type { Place } from './geocoding'
import { haversineM, type LonLat } from './geo'

/** Ends closer than this are one place to the rider: a loop, even when "here" was located twice a few metres apart. */
const SAME_PLACE_M = 150

/** A loop's finish is its start again: the rider's own position stays "here", so it is never stored as a place. */
export function backToStart(start: Place, detail: string): Place {
  return { label: start.label, position: start.position, ...(start.here && { here: true as const }), detail }
}

/** The trip ends where it started, so the map shows one start and finish instead of B on top of A. */
export function isLoop(from: LonLat, to: LonLat): boolean {
  return haversineM(from, to) < SAME_PLACE_M
}

/** The list with the item at `from` moved to `to`, the others keeping their order. */
export function moveVia<T>(list: T[], from: number, to: number): T[] {
  const moved = list.filter((_, index) => index !== from)
  moved.splice(Math.max(0, Math.min(to, moved.length)), 0, list[from])
  return moved
}

/**
 * Where a stop dropped on the map goes among the trip's stops: between the two consecutive points of the trip
 * (`points`: start, stops, finish) it lengthens least as the crow flies. The rider can move it after.
 */
export function insertionIndex(points: LonLat[], stop: LonLat): number {
  let best = 0
  let bestDetourM = Infinity
  for (let leg = 0; leg < points.length - 1; leg++) {
    const detourM = haversineM(points[leg], stop) + haversineM(stop, points[leg + 1]) - haversineM(points[leg], points[leg + 1])
    if (detourM < bestDetourM) {
      bestDetourM = detourM
      best = leg
    }
  }
  return best
}

const samePoint = (a: LonLat, b: LonLat) => a[0] === b[0] && a[1] === b[1]

/**
 * The stops that make a leg: a stop on the place just before it (the start or the previous stop), or on the finish when
 * it is the last, would make a leg of nothing, and goes.
 */
export function distinctStops<T extends { position: LonLat }>(from: T, stops: T[], to: T): T[] {
  const kept: T[] = []
  for (const stop of stops) {
    const previous = kept.at(-1) ?? from
    if (!samePoint(previous.position, stop.position)) kept.push(stop)
  }
  while (kept.length > 0 && samePoint(kept[kept.length - 1].position, to.position)) kept.pop()
  return kept
}

/**
 * Where a dragged stop lands: after every other stop whose middle it has reached. `y` is the dragged stop's middle,
 * `middles` the stops' middles as they stood when the drag began; its own does not count. Reaching a neighbour's middle
 * counts, so a drag of exactly one row moves it one row, down as well as up.
 */
export function dropIndex(middles: number[], from: number, y: number): number {
  // A neighbour's middle counts as reached in the direction of the drag: above it must be passed, below it reached.
  return middles.filter((middle, index) => (index < from ? middle < y : index > from && middle <= y)).length
}

/** The stops without the one tapped on the map: every stop on that point goes, as the map shows them as one. */
export function withoutStopAt<T extends { position: LonLat }>(stops: T[], at: LonLat): T[] {
  return stops.filter((stop) => !samePoint(stop.position, at))
}

/**
 * The trip ended at the stop tapped on the map: that stop is the finish, and the old finish and the stops after the new
 * one go, as the ride no longer reaches them. Null when no stop is on that point.
 */
export function endAtStop<T extends { position: LonLat }>(stops: T[], at: LonLat): { via: T[]; to: T } | null {
  const index = stops.findIndex((stop) => samePoint(stop.position, at))
  if (index < 0) return null
  return { via: stops.slice(0, index), to: stops[index] }
}
