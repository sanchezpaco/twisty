import { describe, expect, it } from 'vitest'
import { IMAGERY_YEARS, mapStyle, PNOA_CREDIT, PNOA_FROM_ZOOM, SENTINEL_CREDIT, TERRAIN_SOURCE } from './style'
import { IMAGERY_LAYERS } from './theme'

const attribution = (source: string) => {
  const spec = mapStyle('satellite').sources[source]
  return 'attribution' in spec ? spec.attribution : ''
}

describe('mapStyle', () => {
  // The Terrain Tiles terms require these credits wherever the elevation is shown.
  it('credits every source of the elevation tiles', () => {
    const credit = attribution(TERRAIN_SOURCE)
    expect(credit).toContain('Copernicus')
    expect(credit).toContain('USGS')
    expect(credit).toContain('NOAA')
  })

  // The licence of the IGN imagery asks for these formulas, dated, wherever the photo is shown.
  it('credits the orthophotos and the Sentinel mosaic with their dated formulas', () => {
    expect(PNOA_CREDIT).toBe(
      `<a href="https://pnoa.ign.es/" target="_blank" rel="noopener">PNOA</a> ${IMAGERY_YEARS.pnoa} CC-BY 4.0 <a href="https://www.scne.es/" target="_blank" rel="noopener">scne.es</a>`,
    )
    expect(SENTINEL_CREDIT).toBe(
      `MosaicoSentinel2 ${IMAGERY_YEARS.sentinel} CC-BY 4.0 <a href="https://www.ign.es/" target="_blank" rel="noopener">ign.es</a>, contains modified Copernicus Sentinel data`,
    )
    expect(IMAGERY_YEARS).toEqual({ pnoa: '2022-2025', sentinel: '2018-2026' })
    const [sentinel, pnoa] = IMAGERY_LAYERS
    expect(attribution(sentinel)).toBe(SENTINEL_CREDIT)
    expect(attribution(pnoa)).toBe(PNOA_CREDIT)
  })

  it('draws each half of the imagery at the zooms its credit covers', () => {
    const layers = new Map(mapStyle('satellite').layers.map((layer) => [layer.id, layer]))
    const [sentinel, pnoa] = IMAGERY_LAYERS
    expect(layers.get(sentinel)).toMatchObject({ source: sentinel, maxzoom: PNOA_FROM_ZOOM })
    expect(layers.get(pnoa)).toMatchObject({ source: pnoa, minzoom: PNOA_FROM_ZOOM })
  })
})
