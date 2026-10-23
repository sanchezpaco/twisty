import { describe, expect, it } from 'vitest'
import { decodePolyline } from './data/polyline'
import type { LonLat } from './geo'
import { googleMapsDirectionsUrl, MAX_WAYPOINTS, twistyPins } from './googleMaps'

/** A straight east-west line of the given length at the equator. */
const lineOfKm = (km: number): LonLat[] => [
  [0, 0],
  [km / 111.195, 0],
]

/** A twisty along the equator with a vertex at each of the given km. */
const twisty = (km: number[], keepOut: [number, number][] = []) => ({ line: km.map((k): LonLat => [k / 111.195, 0]), keepOut })

describe('twistyPins', () => {
  it('pins the entry and exit of short twisties, slightly inside', () => {
    const [{ pins, complete }] = twistyPins([{ line: lineOfKm(5), keepOut: [] }])
    expect(complete).toBe(true)
    expect(pins).toHaveLength(2)
    expect(pins[0][0]).toBeCloseTo(0.25 / 111.195, 4)
  })

  it('adds interior pins to long twisties within the waypoint limit', () => {
    const pins = twistyPins([lineOfKm(60), lineOfKm(5), lineOfKm(30)].map((line) => ({ line, keepOut: [] }))).flatMap((twisty) => twisty.pins)
    expect(pins).toHaveLength(MAX_WAYPOINTS)
  })

  it('moves a pin off a kept-out stretch to the nearest clear point', () => {
    const [{ pins }] = twistyPins([twisty([0, 0.1, 0.5, 5], [[1, 2]])])
    expect(pins[0][0]).toBeCloseTo(0.07 / 111.195, 6)
    expect(pins[1][0]).toBeCloseTo(4.75 / 111.195, 6)
  })

  it('leaves out a pin with no clear point on its twisty', () => {
    expect(twistyPins([twisty([0, 5], [[0, 1]])])).toEqual([{ pins: [], complete: false }])
  })
})

describe('googleMapsDirectionsUrl', () => {
  it('builds a directions URL with lat,lon pairs', () => {
    const url = new URL(googleMapsDirectionsUrl([-3.7, 40.4], [-3.6, 37.2], [[-3.5, 39]]))
    expect(url.searchParams.get('origin')).toBe('40.40000,-3.70000')
    expect(url.searchParams.get('destination')).toBe('37.20000,-3.60000')
    expect(url.searchParams.get('waypoints')).toBe('39.00000,-3.50000')
    expect(url.searchParams.get('travelmode')).toBe('driving')
  })

  it('leaves the origin out when there is none, for Google Maps to start from the phone', () => {
    const url = new URL(googleMapsDirectionsUrl(null, [-3.6, 37.2], []))
    expect(url.searchParams.has('origin')).toBe(false)
    expect(url.searchParams.get('destination')).toBe('37.20000,-3.60000')
  })
})

describe('decodePolyline', () => {
  it('decodes the reference example into lon,lat pairs', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ])
  })
})
