/** A regional view: the start with the towns and roads around it, where the finish is usually searched and picked. */
export const START_ZOOM = 9
export const START_EASE_MS = 900

/**
 * Whether the camera goes to a start set alone. Not once a finish or a ride is there (the ride is framed), and not when
 * the start is already in view close enough, as after a long-press on the map.
 */
export function goesToStart(view: { start: boolean; finish: boolean; ride: boolean; zoom: number; startInView: boolean }): boolean {
  if (!view.start || view.finish || view.ride) return false
  return !(view.startInView && view.zoom >= START_ZOOM - 1)
}
