/** From this width the trip lives in a floating side panel; below it, in the bottom sheet. Mirrored in CSS media queries. */
const SIDE_PANEL_QUERY = '(min-width: 700px)'
const WIDE_SIDE_PANEL_QUERY = '(min-width: 1024px)'

const NARROW_PANEL_WIDTH = 360
const WIDE_PANEL_WIDTH = 400
/** Gap between the panel and the screen edge, and the air between the panel and the framed route. */
const PANEL_EDGE_GAP = 16
const PANEL_ROUTE_GAP = 40

export interface ScreenInsets {
  top: number
  bottom: number
  left: number
  right: number
}

export const isSidePanel = () => window.matchMedia(SIDE_PANEL_QUERY).matches

/** Calls back when the window crosses a layout breakpoint, e.g. a Fold being opened or closed. */
export function onLayoutChange(callback: () => void): () => void {
  const queries = [SIDE_PANEL_QUERY, WIDE_SIDE_PANEL_QUERY].map((query) => window.matchMedia(query))
  for (const query of queries) query.addEventListener('change', callback)
  return () => {
    for (const query of queries) query.removeEventListener('change', callback)
  }
}

/** The part of the map the side panel covers. */
export function sidePanelCover(): number {
  const width = window.matchMedia(WIDE_SIDE_PANEL_QUERY).matches ? WIDE_PANEL_WIDTH : NARROW_PANEL_WIDTH
  return PANEL_EDGE_GAP + width
}

/** Breathing room between a framed route and the edges of the visible map, next to the side panel. */
export function sidePanelFitMargin(): ScreenInsets {
  const wide = window.matchMedia(WIDE_SIDE_PANEL_QUERY).matches
  return { top: 60, bottom: 60, left: PANEL_ROUTE_GAP, right: wide ? 80 : 60 }
}
