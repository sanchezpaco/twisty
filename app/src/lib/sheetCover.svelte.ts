/**
 * How tall the sheet open over the phone's map is, so the map's credit stands above it instead of under its edge. The
 * credits sheet leaves it at zero: it covers the map's foot whole and spells the credits out itself.
 */
export const sheetCover = $state({ heightPx: 0 })

/** Room kept between the phone sheet's top edge and the map's top controls before they fade out of its way. */
export const CONTROLS_CLEARANCE_PX = 8

/**
 * The map's top controls (legend, 3D, styles): `bottomPx` is where they end, measured by the map; `covered` is set by the
 * sheet when its top edge reaches them, so they fade out instead of showing cut under it.
 */
export const mapControls = $state({ bottomPx: 0, covered: false })

/** Whether a sheet showing `visiblePx` of a `screenPx`-tall screen reaches controls that end at `controlsBottomPx`. */
export function reachesControls(visiblePx: number, screenPx: number, controlsBottomPx: number): boolean {
  return controlsBottomPx > 0 && screenPx - visiblePx <= controlsBottomPx + CONTROLS_CLEARANCE_PX
}
