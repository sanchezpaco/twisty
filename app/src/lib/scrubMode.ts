/**
 * How the map follows a finger dragging the ride slider. In full mode every option it passes is revealed and flown to;
 * a phone that cannot keep up goes light: the rides swap in at once and the camera waits for the release. The frames
 * of the drag itself decide, and the device remembers a phone that had to go light, so its later drags start light.
 */

/** A frame this long has missed three vsyncs at 60 Hz. One map redraw takes about 33 ms on the slow reference phone. */
export const SLOW_FRAME_MS = 50
/** Slow frames within one drag that send it light: one stray frame (a garbage collection) does not. */
export const SLOW_FRAMES_TO_SWITCH = 3
/** First frames of a drag, left out: the touch that starts a gesture costs a frame of its own. */
export const GRACE_FRAMES = 2
/** Drags in a row that went light before the device is remembered as light: one busy moment does not pin a good phone. */
export const CONFIRM_DRAGS = 2
/** Frames a drag must last to show that full mode keeps up; a shorter one says nothing either way. */
export const JUDGED_FRAMES = 30

const STORAGE_KEY = 'twisty.scrubMode'

export interface Drag {
  light: boolean
  /** It started light because the device is remembered as light: it measures nothing new. */
  startedLight: boolean
  frames: number
  slowFrames: number
}

export interface ScrubMemory {
  /** The build that measured it: a new build may be faster, so it measures afresh. */
  build: string
  /** Drags in a row that went light. */
  lightDrags: number
}

/**
 * The bundled file this module lands in carries a content hash, so its URL changes with every build that changes the
 * code; the web layer has no other version of the app.
 */
export const BUILD = new URL(import.meta.url).pathname

export function startDrag(memory: ScrubMemory): Drag {
  const light = memory.lightDrags >= CONFIRM_DRAGS
  return { light, startedLight: light, frames: 0, slowFrames: 0 }
}

/** A drag never goes back to full: a ride that starts flying again mid-drag would look worse than one that stays light. */
export function nextFrame(drag: Drag, deltaMs: number): Drag {
  const frames = drag.frames + 1
  if (frames <= GRACE_FRAMES) return { ...drag, frames }
  const slowFrames = drag.slowFrames + (deltaMs > SLOW_FRAME_MS ? 1 : 0)
  return { ...drag, frames, slowFrames, light: drag.light || slowFrames >= SLOW_FRAMES_TO_SWITCH }
}

export function rememberDrag(memory: ScrubMemory, drag: Drag): ScrubMemory {
  if (drag.startedLight) return memory
  if (drag.light) return { ...memory, lightDrags: memory.lightDrags + 1 }
  return drag.frames >= JUDGED_FRAMES ? { ...memory, lightDrags: 0 } : memory
}

export function serializeScrubMemory(memory: ScrubMemory): string {
  return JSON.stringify(memory)
}

/** Stored text is outside the app's control; anything odd, or another build's memory, starts afresh. */
export function parseScrubMemory(text: string | null, build: string): ScrubMemory {
  const fresh = { build, lightDrags: 0 }
  if (!text) return fresh
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fresh
  }
  if (typeof data !== 'object' || data === null) return fresh
  const { build: stored, lightDrags } = data as Record<string, unknown>
  if (stored !== build || typeof lightDrags !== 'number' || !Number.isInteger(lightDrags) || lightDrags < 0) return fresh
  return { build, lightDrags }
}

export function loadScrubMemory(build: string): ScrubMemory {
  try {
    return parseScrubMemory(localStorage.getItem(STORAGE_KEY), build)
  } catch {
    return { build, lightDrags: 0 }
  }
}

/** A device that never went light keeps no key at all. */
export function saveScrubMemory(memory: ScrubMemory): void {
  try {
    if (memory.lightDrags > 0) localStorage.setItem(STORAGE_KEY, serializeScrubMemory(memory))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage is unavailable: each drag still measures and goes light for itself, it is just not remembered.
  }
}

/** Calls `onframe` with the time since the last frame on every frame until the returned function is called. */
export function everyFrame(onframe: (deltaMs: number) => void): () => void {
  let last: number | undefined
  let frame = requestAnimationFrame(function tick(now) {
    if (last !== undefined) onframe(now - last)
    last = now
    frame = requestAnimationFrame(tick)
  })
  return () => cancelAnimationFrame(frame)
}
