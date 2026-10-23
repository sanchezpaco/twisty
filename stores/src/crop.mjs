// Where a phone screenshot's card sits on the canvas and which part of the capture it shows. Shared by the render
// (screenshot.html) and the capture, which moves the map until nothing is cut at the card's edges.
export const CANVAS = { width: 1080, height: 1920 }
/** The card: its width on the canvas and the top of it; it runs off the canvas's bottom edge. */
export const CARD = { width: 908, top: 533 }
/** How far under the part a shot is about the card ends, in the app's CSS pixels. */
const BOTTOM_PAD = 12

/**
 * The capture's rows the card shows, in the app's CSS pixels. The shot's `crop` (assets.json) says what it hangs from:
 * `{ to: key }` ends a little under `boxes[key]`, `{ below: key, gap }` starts just under it (the map's buttons, say),
 * `{ from: key, above }` starts `above` px over its top. The card is as tall as the canvas allows, unless `until: key`
 * ends it under that element: then it is shorter, and its bottom corners show.
 */
export function cropWindow(boxes, crop) {
  const scale = CARD.width / boxes.viewport.w
  const height = (CANVAS.height - CARD.top) / scale
  const a = boxes[crop.to ?? crop.below ?? crop.from]
  if (!a) throw new Error(`no box for the crop ${JSON.stringify(crop)}`)
  const pad = crop.pad ?? BOTTOM_PAD
  if (crop.to) {
    const bottom = Math.min(boxes.viewport.h, a.y + a.h + pad)
    return { top: Math.max(0, bottom - height), bottom, scale, ends: false }
  }
  const top = crop.below ? a.y + a.h + (crop.gap ?? 4) : Math.max(0, a.y - (crop.above ?? 0))
  const end = crop.until && boxes[crop.until]
  if (end) return { top, bottom: Math.min(top + height, end.y + end.h + pad), scale, ends: true }
  return { top, bottom: top + height, scale, ends: false }
}
