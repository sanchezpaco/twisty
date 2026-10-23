import { describe, expect, it } from 'vitest'
import { gpxTrack } from './gpx'
import type { RideOption } from './routing/ride'
import { isSameRide, parseSavedRide, rideOfSaved, savedRideOf, type SavedRideFields } from './savedRide'

const option: RideOption = {
  edges: [4, 8, 15],
  timeS: 9300,
  extraS: 2640,
  distanceM: 149_000,
  curvyM: 40_000,
  twistyM: 56_000,
  motorwayM: 84_000,
  trackM: 0,
  otherM: 9_000,
  twisties: [
    {
      label: 'N-260 · Coll de Fadas',
      lengthM: 12_000,
      rating: 4,
      narrowM: 1_500,
      postedKmh: 40,
      fordCount: 0,
      leg: 0,
      line: [
        [0.1234567, 42.4567891],
        [0.2, 42.5],
      ],
    },
  ],
  segments: [
    {
      kind: 'transit',
      line: [
        [-0.5494, 42.5693],
        [0.1234567, 42.4567891],
      ],
    },
    {
      kind: 'twisty',
      rating: 4,
      line: [
        [0.1234567, 42.4567891],
        [0.2, 42.5],
      ],
    },
  ],
  googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=42.56930,-0.54940',
  pinnedAll: true,
  legs: [{ timeS: 9300, distanceM: 149_000, twistyM: 56_000, curvyM: 40_000 }],
  coverageRoad: 'N-260 · Coll de Fadas',
}

const jaca = { label: 'Jaca', position: [-0.5494, 42.5693] as [number, number] }
const benasque = { label: 'Benasque', position: [0.5237, 42.6053] as [number, number] }
const fields: SavedRideFields = {
  id: 'r1',
  name: 'Jaca → Benasque',
  folderId: null,
  savedAt: 7,
  from: jaca,
  to: benasque,
  via: [],
  dataAt: null,
}

describe('a saved ride', () => {
  it('keeps no graph edges, and gives back the ride it was saved from to a millionth of a degree', () => {
    const saved = savedRideOf(option, fields)
    expect('edges' in saved.ride).toBe(false)
    const back = rideOfSaved(saved)
    expect({ ...back, segments: [], twisties: [] }).toEqual({ ...option, edges: [], segments: [], twisties: [] })
    expect(back.twisties[0]).toMatchObject({ ...option.twisties[0], line: expect.any(Array) })
    const points = (ride: RideOption) => [...ride.segments, ...ride.twisties].flatMap((part) => part.line).flat()
    points(back).forEach((value, i) => expect(value).toBeCloseTo(points(option)[i], 6))
  })

  it('hands over the same GPX and Google Maps link as the ride did', () => {
    const back = rideOfSaved(savedRideOf(option, fields))
    const line = (ride: RideOption) => ride.segments.flatMap((segment) => segment.line)
    expect(gpxTrack('ride', line(back))).toBe(gpxTrack('ride', line(option)))
    expect(back.googleMapsUrl).toBe(option.googleMapsUrl)
  })

  it('reads back from storage, and refuses what this version does not write', () => {
    const saved = savedRideOf(option, fields)
    expect(parseSavedRide(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
    expect(parseSavedRide({ ...saved, via: undefined })).toBeNull()
    expect(parseSavedRide({ ...saved, ride: { ...saved.ride, timeS: 'long' } })).toBeNull()
    expect(parseSavedRide({ ...saved, ride: { ...saved.ride, segments: [{ kind: 'ferry', line: '' }] } })).toBeNull()
    expect(parseSavedRide({ ...saved, ride: { ...saved.ride, segments: [{ kind: 'transit', line: '~' }] } })).toBeNull()
    expect(parseSavedRide(null)).toBeNull()
  })

  it('keeps the fords, the closures and the roads it was saved with, and refuses them malformed', () => {
    const roads = [{ label: 'AV-901', lengthM: 34_800 }, { label: '', lengthM: 2_000 }]
    const counted: RideOption = { ...option, fordCount: 3, closedPartOfYear: true, closedRoads: ['Ma-2210 · Carretera de Formentor'], twisties: option.twisties.map((twisty) => ({ ...twisty, closedPartOfYear: true, roads })) }
    const saved = savedRideOf(counted, fields)
    const read = parseSavedRide(JSON.parse(JSON.stringify(saved)))
    expect(read?.ride.fordCount).toBe(3)
    expect(read?.ride.closedPartOfYear).toBe(true)
    expect(read?.ride.closedRoads).toEqual(['Ma-2210 · Carretera de Formentor'])
    expect(parseSavedRide({ ...saved, ride: { ...saved.ride, closedRoads: 'Ma-2210' } })).toBeNull()
    expect(read?.ride.twisties.every((twisty) => twisty.closedPartOfYear)).toBe(true)
    expect(read?.ride.twisties[0].roads).toEqual(roads)
    expect(parseSavedRide({ ...saved, ride: { ...saved.ride, twisties: [{ ...saved.ride.twisties[0], roads: [{ label: 'AV-901' }] }] } })).toBeNull()
    expect(parseSavedRide({ ...saved, ride: { ...saved.ride, fordCount: 'many' } })).toBeNull()
    expect(parseSavedRide({ ...saved, ride: { ...saved.ride, closedPartOfYear: 'yes' } })).toBeNull()
    expect(parseSavedRide({ ...saved, ride: { ...saved.ride, twisties: [{ ...saved.ride.twisties[0], closedPartOfYear: 1 }] } })).toBeNull()
  })

  it('is the same ride only with the same places and the same Google Maps link', () => {
    const saved = savedRideOf(option, fields)
    expect(isSameRide(saved, option, jaca, benasque, [])).toBe(true)
    expect(isSameRide(saved, { ...option, googleMapsUrl: 'other' }, jaca, benasque, [])).toBe(false)
    expect(isSameRide(saved, option, benasque, jaca, [])).toBe(false)
    expect(isSameRide(saved, option, jaca, benasque, [jaca])).toBe(false)
  })

  // Saved before trips had stops: no legs, no leg per twisty, no pins flag.
  it('reads a ride saved before stops as one leg, and does not claim its pins', () => {
    const saved = JSON.parse(JSON.stringify(savedRideOf(option, fields)))
    delete saved.ride.legs
    delete saved.ride.pinnedAll
    for (const twisty of saved.ride.twisties) delete twisty.leg
    const read = parseSavedRide(saved)
    expect(read?.ride.legs).toEqual([{ timeS: option.timeS, distanceM: option.distanceM, twistyM: option.twistyM, curvyM: option.curvyM }])
    expect(read?.ride.pinnedAll).toBe(false)
    expect(read?.ride.twisties.map((twisty) => twisty.leg)).toEqual([0])
    expect(parseSavedRide({ ...saved, ride: { ...saved.ride, legs: [] } })).toBeNull()
  })

  // A start at "My location" is saved under its town's name; the ride on screen still says "My location".
  it('is recognised whatever its places are called', () => {
    const saved = savedRideOf(option, { ...fields, from: { label: 'Jaca', position: jaca.position } })
    expect(isSameRide(saved, option, { label: 'My location', position: jaca.position }, benasque, [])).toBe(true)
  })
})
