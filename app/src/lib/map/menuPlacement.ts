/** A pin's half size and some air: a menu edge closer than this to a pin's centre covers it. */
export const PIN_CLEARANCE_PX = 22

interface Point {
  x: number
  y: number
}

/** The menu's size, and its distance from the pressed point. */
export interface MenuSize {
  halfWidth: number
  height: number
  gap: number
}

/** Where the menu may go: its centre within `minX`..`maxX`, its foot above `bottom` (where the sheet or the panel starts). */
export interface MenuRoom {
  minX: number
  maxX: number
  bottom: number
}

/** The menu's centre, and whether it opens under the point. */
export interface MenuPlacement {
  x: number
  below: boolean
}

/**
 * Where the map menu opens: above the point, unless A or B would hide under it. Then below it if it fits there clear of
 * them, or else above and slid sideways off the pin, as long as it still spans the point. With no way clear it stays put.
 */
export function placeMenu(at: Point, pins: Point[], menu: MenuSize, room: MenuRoom): MenuPlacement {
  const clamp = (x: number) => Math.min(Math.max(x, room.minX), room.maxX)
  const covers = (x: number, top: number) =>
    pins.some((pin) => Math.abs(pin.x - x) < menu.halfWidth + PIN_CLEARANCE_PX && pin.y > top - PIN_CLEARANCE_PX && pin.y < top + menu.height + PIN_CLEARANCE_PX)
  const x = clamp(at.x)
  const above = at.y - menu.gap - menu.height
  const below = at.y + menu.gap
  if (!covers(x, above)) return { x, below: false }
  if (below + menu.height <= room.bottom && !covers(x, below)) return { x, below: true }
  const aside = pins
    .flatMap((pin) => [pin.x - menu.halfWidth - PIN_CLEARANCE_PX, pin.x + menu.halfWidth + PIN_CLEARANCE_PX].map(clamp))
    .filter((candidate) => Math.abs(candidate - at.x) <= menu.halfWidth && !covers(candidate, above))
    .sort((a, b) => Math.abs(a - x) - Math.abs(b - x))
  return { x: aside[0] ?? x, below: false }
}
