export type SnapName = 'peek' | 'half' | 'full'

export interface Snap {
  name: SnapName
  /** How much of the sheet shows above the bottom of the screen. */
  visiblePx: number
}

export interface SheetMeasures {
  /** Visible height of the smallest snap: grabber, trip row, headline and the pinned footer. */
  peekPx: number
  /** Visible height of the middle snap: the peek plus the slider. */
  halfPx: number
  /** Everything the sheet holds, pinned footer included. */
  contentPx: number
  viewportPx: number
  /** Space kept free above the full snap: the status bar and a strip of map. */
  topReservePx: number
}

/** Two snaps closer than this are one in the rider's eyes. */
const MIN_SNAP_GAP_PX = 24
/** Fastest flick that still settles by direction rather than by nearest snap. */
const FLICK_PX_PER_MS = 0.4
/** Only the latest part of the gesture says how fast the finger was going when it let go. */
const VELOCITY_WINDOW_MS = 100
/** Past the first or last snap the sheet follows the finger at this fraction, up to a limit. */
const RUBBER_BAND = 0.35
const RUBBER_BAND_MAX_PX = 48

export interface DragSample {
  timeMs: number
  /** Visible height of the sheet at that moment. */
  visiblePx: number
}

/** The snaps a sheet offers, lowest first; a snap taller than the content, or too close to the next, is dropped. */
export function snapsFor({ peekPx, halfPx, contentPx, viewportPx, topReservePx }: SheetMeasures): Snap[] {
  const fullPx = Math.min(contentPx, viewportPx - topReservePx)
  const candidates: Snap[] = [
    { name: 'peek', visiblePx: Math.min(peekPx, fullPx) },
    { name: 'half', visiblePx: Math.min(halfPx, fullPx) },
    { name: 'full', visiblePx: fullPx },
  ]
  const snaps: Snap[] = []
  for (const candidate of candidates) {
    const last = snaps[snaps.length - 1]
    if (!last || candidate.visiblePx - last.visiblePx >= MIN_SNAP_GAP_PX) snaps.push(candidate)
    // The tallest candidate always stays: a near-duplicate below it gives way.
    else if (candidate.name === 'full') snaps[snaps.length - 1] = candidate
  }
  return snaps
}

/** Where the sheet shows while the finger drags it: 1:1 between the snaps, resisting beyond the ends. */
export function followFinger(rawVisiblePx: number, snaps: Snap[]): number {
  const lowest = snaps[0].visiblePx
  const highest = snaps[snaps.length - 1].visiblePx
  if (rawVisiblePx > highest) return highest + Math.min(RUBBER_BAND_MAX_PX, (rawVisiblePx - highest) * RUBBER_BAND)
  if (rawVisiblePx < lowest) return lowest - Math.min(RUBBER_BAND_MAX_PX, (lowest - rawVisiblePx) * RUBBER_BAND)
  return rawVisiblePx
}

/** Speed of the finger at release in px/ms, positive when the sheet was going up. */
export function releaseVelocity(samples: DragSample[]): number {
  const last = samples[samples.length - 1]
  if (!last) return 0
  const first = samples.find((sample) => last.timeMs - sample.timeMs <= VELOCITY_WINDOW_MS)!
  const elapsedMs = last.timeMs - first.timeMs
  return elapsedMs > 0 ? (last.visiblePx - first.visiblePx) / elapsedMs : 0
}

/**
 * The snap a released sheet settles on: after a flick the next one past where the drag began (or past the finger, if
 * it already went further), otherwise the nearest.
 */
export function settleSnap(snaps: Snap[], startPx: number, visiblePx: number, velocityPxPerMs: number): Snap {
  if (Math.abs(velocityPxPerMs) >= FLICK_PX_PER_MS) {
    const up = velocityPxPerMs > 0
    const beyond = up
      ? snaps.find((snap) => snap.visiblePx > Math.max(startPx, visiblePx))
      : snaps.findLast((snap) => snap.visiblePx < Math.min(startPx, visiblePx))
    return beyond ?? snaps[up ? snaps.length - 1 : 0]
  }
  return snaps.reduce((best, snap) => (Math.abs(snap.visiblePx - visiblePx) < Math.abs(best.visiblePx - visiblePx) ? snap : best))
}

/** What a tap on the grabber does: up from the lowest snap, down from the highest, up in between until the top. */
export function cycleSnap(snaps: Snap[], current: SnapName): Snap {
  const index = Math.max(0, snaps.findIndex((snap) => snap.name === current))
  const last = snaps.length - 1
  const next = index === last ? last - 1 : index + 1
  return snaps[Math.max(0, next)]
}
