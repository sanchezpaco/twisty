import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import type { MapTheme } from '../lib/map/theme'
import { OSM_CREDIT, PNOA_CREDIT, SENTINEL_CREDIT } from '../lib/map/style'
import MapCredit from './MapCredit.svelte'

const html = (props: Partial<{ theme: MapTheme; pnoa: boolean; terrain: boolean; unavailable: boolean }>) =>
  render(MapCredit, {
    props: { theme: 'satellite', pnoa: false, terrain: false, unavailable: false, coveredHeight: 0, onusedark: () => {}, ...props },
  }).body

describe('MapCredit', () => {
  // The OSMF guideline asks for the credit without a tap: it is at the map's foot in every style, never folded into the (i).
  it('credits OpenStreetMap, OpenMapTiles and OpenFreeMap in every style', () => {
    for (const theme of ['dark', 'light', 'satellite'] as const) expect(html({ theme })).toContain(OSM_CREDIT)
    expect(OSM_CREDIT).toContain('openstreetmap.org/copyright')
  })

  it('joins the credit of the imagery in view while the satellite map is on, and only then', () => {
    expect(html({ pnoa: false })).toContain(SENTINEL_CREDIT)
    expect(html({ pnoa: false }).indexOf(OSM_CREDIT)).toBeLessThan(html({ pnoa: false }).indexOf(SENTINEL_CREDIT))
    expect(html({ pnoa: true })).toContain(PNOA_CREDIT)
    expect(html({ pnoa: true })).not.toContain('MosaicoSentinel2')
    expect(html({ theme: 'dark' })).not.toContain('MosaicoSentinel2')
    expect(html({ theme: 'light' })).not.toContain('PNOA')
  })

  it('credits both sources when the relief is tilted, since the far half of a close view is Sentinel-2', () => {
    const tilted = html({ pnoa: true, terrain: true })
    expect(tilted).toContain(PNOA_CREDIT)
    expect(tilted).toContain(SENTINEL_CREDIT)
    expect(html({ pnoa: false, terrain: true })).not.toContain(PNOA_CREDIT)
  })

  it('opens the full credits from the (i), in every style', () => {
    for (const theme of ['dark', 'light', 'satellite'] as const) expect(html({ theme })).toContain('aria-label="Credits"')
  })

  it('offers the dark map when the satellite cannot be loaded, and keeps every credit for the tiles already shown', () => {
    expect(html({})).not.toContain('Use dark')
    const failed = html({ unavailable: true })
    expect(failed).toContain('Satellite is unavailable')
    expect(failed).toContain('Use dark')
    expect(failed).toContain(OSM_CREDIT)
    expect(failed).toContain(SENTINEL_CREDIT)
  })
})
