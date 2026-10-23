import { followFinger, releaseVelocity, settleSnap, type DragSample, type Snap } from './sheet'

/** How far a finger travels before a touch counts as a drag rather than a tap. */
const SLOP_PX = 6
/** Controls that keep their own touches: a caret and text selection, or a slider being scrubbed. */
const KEEPS_TOUCH = 'input, [data-no-drag]'

export interface SheetDragHost {
  /** The snaps the sheet offers right now, lowest first. */
  snaps(): Snap[]
  /** Where the sheet rests, as the visible height. */
  restingPx(): number
  /** A drag has begun: the sheet stops easing towards its snap and follows the finger. */
  begin(): void
  /** Where the finger puts the sheet, as the visible height. Called at most once per frame. */
  move(visiblePx: number): void
  /** The finger let go: the sheet eases to this snap. */
  settle(snap: Snap): void
}

interface Gesture {
  startPx: number
  startY: number
  visiblePx: number
  samples: DragSample[]
}

/**
 * Turns touches into a sheet drag. The maths lives in `sheet.ts`; this only reads the finger and writes one position
 * per frame, and never reads layout while a drag runs.
 */
export function createSheetDrag(host: SheetDragHost) {
  let gesture: Gesture | null = null
  let frame = 0

  function begin(y: number) {
    gesture = { startPx: host.restingPx(), startY: y, visiblePx: host.restingPx(), samples: [] }
    host.begin()
  }

  function follow(y: number, timeMs: number) {
    if (!gesture) return
    gesture.visiblePx = followFinger(gesture.startPx - (y - gesture.startY), host.snaps())
    gesture.samples.push({ timeMs, visiblePx: gesture.visiblePx })
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (gesture) host.move(gesture.visiblePx)
    })
  }

  function release() {
    if (!gesture) return
    cancelAnimationFrame(frame)
    frame = 0
    const { startPx, visiblePx, samples } = gesture
    gesture = null
    host.settle(settleSnap(host.snaps(), startPx, visiblePx, releaseVelocity(samples)))
  }

  /** The grabber, the trip row and the headline: a touch that travels far enough up or down drags the sheet. */
  function handle(node: HTMLElement) {
    let pointerId = -1
    let origin: { x: number; y: number } | null = null
    let dragged = false

    function down(event: PointerEvent) {
      if (pointerId !== -1 || host.snaps().length < 2) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if ((event.target as Element).closest(KEEPS_TOUCH)) return
      pointerId = event.pointerId
      origin = { x: event.clientX, y: event.clientY }
    }

    function move(event: PointerEvent) {
      if (event.pointerId !== pointerId || !origin) return
      if (!gesture) {
        const dy = event.clientY - origin.y
        if (Math.abs(dy) < SLOP_PX) return
        if (Math.abs(dy) <= Math.abs(event.clientX - origin.x)) return stop()
        node.setPointerCapture(pointerId)
        begin(event.clientY)
        dragged = true
      }
      follow(event.clientY, event.timeStamp)
    }

    function up(event: PointerEvent) {
      if (event.pointerId !== pointerId) return
      release()
      stop()
      // The click that ends a drag is not a tap on the grabber or on the trip row.
      if (dragged) setTimeout(() => (dragged = false))
    }

    function stop() {
      pointerId = -1
      origin = null
    }

    function swallowClick(event: MouseEvent) {
      if (!dragged) return
      event.stopPropagation()
      event.preventDefault()
    }

    node.addEventListener('pointerdown', down)
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
    node.addEventListener('click', swallowClick, true)
    return {
      destroy() {
        node.removeEventListener('pointerdown', down)
        node.removeEventListener('pointermove', move)
        node.removeEventListener('pointerup', up)
        node.removeEventListener('pointercancel', up)
        node.removeEventListener('click', swallowClick, true)
      },
    }
  }

  /**
   * The scrolling body of a full sheet: it scrolls as usual, but a downward drag that starts at its top hands the
   * touch to the sheet, so the sheet folds without the rider having to find the grabber.
   */
  function scroller(node: HTMLElement) {
    let origin: { x: number; y: number } | null = null
    let atTop = false

    function start(event: TouchEvent) {
      const touch = event.touches[0]
      const alone = event.touches.length === 1 && !(event.target as Element).closest(KEEPS_TOUCH)
      origin = alone ? { x: touch.clientX, y: touch.clientY } : null
      atTop = node.scrollTop <= 0
    }

    function move(event: TouchEvent) {
      if (!origin) return
      const touch = event.touches[0]
      if (!gesture) {
        const dy = touch.clientY - origin.y
        if (!atTop || dy < SLOP_PX || dy <= Math.abs(touch.clientX - origin.x)) return
        begin(touch.clientY)
      }
      event.preventDefault()
      follow(touch.clientY, event.timeStamp)
    }

    function end() {
      origin = null
      release()
    }

    node.addEventListener('touchstart', start, { passive: true })
    node.addEventListener('touchmove', move, { passive: false })
    node.addEventListener('touchend', end)
    node.addEventListener('touchcancel', end)
    return {
      destroy() {
        node.removeEventListener('touchstart', start)
        node.removeEventListener('touchmove', move)
        node.removeEventListener('touchend', end)
        node.removeEventListener('touchcancel', end)
      },
    }
  }

  return { handle, scroller }
}
