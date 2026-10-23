import { describe, expect, it } from 'vitest'
import { haloRadiusAtZoom0, riderPositionData } from './position'

describe('haloRadiusAtZoom0', () => {
  it('spans the fix accuracy in pixels: 100 m is about 10 px at zoom 13 on the equator', () => {
    expect(haloRadiusAtZoom0(100, 0) * 2 ** 13).toBeCloseTo(10.47, 1)
  })

  it('grows towards the poles, where a pixel covers fewer metres', () => {
    expect(haloRadiusAtZoom0(100, 60)).toBeCloseTo(2 * haloRadiusAtZoom0(100, 0), 10)
  })
})

describe('riderPositionData', () => {
  it('draws nothing before a fix', () => {
    expect(riderPositionData(null).features).toEqual([])
  })

  it('places one point at the fix, with its halo', () => {
    const [feature] = riderPositionData({ position: [-0.37, 39.47], accuracyM: 40 }).features
    expect(feature.geometry).toEqual({ type: 'Point', coordinates: [-0.37, 39.47] })
    expect(feature.properties?.halo).toBeCloseTo(haloRadiusAtZoom0(40, 39.47), 12)
  })
})
