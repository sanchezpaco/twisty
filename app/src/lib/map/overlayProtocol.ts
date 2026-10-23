import { addProtocol } from 'maplibre-gl'

const PROTOCOL = 'twisty-overlay'
export const OVERLAY_TILES_URL = `${PROTOCOL}://{z}/{x}/{y}`
const TILES_PATH = `${import.meta.env.BASE_URL}data/overlay/`
const EMPTY_TILE = new ArrayBuffer(0)

/**
 * A tile with no twisties is not shipped, so a missing tile is an empty one. How a host says "missing" varies: a 404,
 * or, for an unknown path, the index page with a 200 (Vite's servers do). Both give an empty tile instead of a map error.
 */
export async function loadOverlayTile(tile: string, signal?: AbortSignal, fetchTile: typeof fetch = fetch): Promise<ArrayBuffer> {
  const response = await fetchTile(`${TILES_PATH}${tile}.pbf`, { signal })
  if (!response.ok || response.headers.get('content-type')?.includes('text/html')) return EMPTY_TILE
  return response.arrayBuffer()
}

export function registerOverlayProtocol(): void {
  addProtocol(PROTOCOL, async ({ url }, abortController) => ({
    data: await loadOverlayTile(url.slice(`${PROTOCOL}://`.length), abortController.signal),
  }))
}
