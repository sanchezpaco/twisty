import { describe, expect, it } from 'vitest'
import { dominantRating, hasWarning, lengthByRating, listedTwisties, NARROW_CHIP_MIN_M, namedClosures, roadWarnings, splitRoadLabel, twistyCaption, twistyRoads, UNNAMED_LINK_MAX_M } from './curves'
import type { RideTwisty } from './routing/ride'

const twisty = (rating: number, lengthM: number): RideTwisty => ({ label: '', rating, lengthM, narrowM: 0, postedKmh: null, fordCount: 0, line: [], leg: 0 })

describe('curve mix', () => {
  it('adds up km per rating', () => {
    expect(lengthByRating([twisty(2, 38_000), twisty(2, 23_000), twisty(3, 13_000)])).toEqual([0, 61_000, 13_000, 0, 0])
  })

  it('names the rating with the most km', () => {
    expect(dominantRating([twisty(2, 24_000), twisty(3, 42_000)])).toBe(3)
    expect(dominantRating([])).toBeNull()
  })
})

describe('splitRoadLabel', () => {
  it('leads with the ref and keeps the name below', () => {
    expect(splitRoadLabel('CV-345 · Carretera de Villar a La Yesa')).toEqual({
      title: 'CV-345',
      subtitle: 'Carretera de Villar a La Yesa',
    })
    expect(splitRoadLabel('CM-2251')).toEqual({ title: 'CM-2251', subtitle: null })
  })
})

describe('namedClosures', () => {
  it('names one or two roads by their ref, and none past that', () => {
    expect(namedClosures(['Ma-2210 · Carretera de Formentor'])).toEqual(['Ma-2210'])
    expect(namedClosures(['Ma-2210 · Carretera de Formentor', 'Camino rural de Riaza'])).toEqual(['Ma-2210', 'Camino rural de Riaza'])
    expect(namedClosures(['CV-345', 'Ma-2210', 'CM-2251'])).toEqual([])
    expect(namedClosures(undefined)).toEqual([])
  })
})

describe('listedTwisties', () => {
  const named = (label: string) => ({ ...twisty(3, 10_000), label })
  const ride = [named('N-322 · Carretera de Albacete'), named('BV-5301 · Carretera del Montseny'), named('A-420')]

  it('keeps riding order and numbers when no road was added', () => {
    expect(listedTwisties(ride, null).map(({ number, added }) => [number, added])).toEqual([[1, false], [2, false], [3, false]])
  })

  it('lists the added road first and keeps its number on the map', () => {
    const listed = listedTwisties(ride, 'BV-5301 · Carretera del Montseny')
    expect(listed.map(({ twisty }) => twisty.label)).toEqual([ride[1].label, ride[0].label, ride[2].label])
    expect(listed.map(({ number, added }) => [number, added])).toEqual([[2, true], [1, false], [3, false]])
  })

  it('finds the road by its ref when the labels differ', () => {
    expect(listedTwisties(ride, 'BV-5301')[0].twisty).toBe(ride[1])
  })

  it('lists nothing as added when the ride does not contain the road', () => {
    expect(listedTwisties(ride, 'AS-227').some(({ added }) => added)).toBe(false)
  })
})

describe('roadWarnings', () => {
  const road = (extra: Partial<RideTwisty>): RideTwisty => ({ ...twisty(4, 10_000), ...extra })

  it('says nothing about an ordinary road', () => {
    const warnings = roadWarnings(road({}))
    expect(warnings).toEqual({ postedKmh: null, narrowM: null, ford: false, closed: false })
    expect(hasWarning(warnings)).toBe(false)
  })

  it('passes the posted limit and the fords on', () => {
    expect(roadWarnings(road({ postedKmh: 30, fordCount: 2 }))).toEqual({ postedKmh: 30, narrowM: null, ford: true, closed: false })
  })

  it('warns about narrow ways only from a named minimum', () => {
    expect(roadWarnings(road({ narrowM: NARROW_CHIP_MIN_M - 1 })).narrowM).toBeNull()
    expect(roadWarnings(road({ narrowM: NARROW_CHIP_MIN_M })).narrowM).toBe(NARROW_CHIP_MIN_M)
    expect(hasWarning(roadWarnings(road({ narrowM: 4_000 })))).toBe(true)
  })

  it('warns about a road closed part of the year, and says nothing when a saved ride did not know', () => {
    expect(roadWarnings(road({ closedPartOfYear: true })).closed).toBe(true)
    expect(hasWarning(roadWarnings(road({ closedPartOfYear: true })))).toBe(true)
    expect(roadWarnings(road({})).closed).toBe(false)
  })
})

describe('twistyRoads', () => {
  const chained = (roads: RideTwisty['roads']): RideTwisty => ({ ...twisty(3, 120_000), label: 'AV-901 · Carretera de Arenas', roads })

  it('lists a chained twisty\'s roads in riding order, each with its own km and by its ref', () => {
    const roads = twistyRoads(chained([{ label: 'M-505', lengthM: 40_000 }, { label: 'AV-901 · Carretera de Arenas', lengthM: 34_800 }, { label: '', lengthM: 12_000 }]), 'Unnamed road')
    expect(roads).toEqual([{ title: 'M-505', lengthM: 40_000 }, { title: 'AV-901', lengthM: 34_800 }, { title: 'Unnamed road', lengthM: 12_000 }])
  })

  it('leaves out a short unnamed link, and lists nothing when one road is left', () => {
    const stub = { label: '', lengthM: UNNAMED_LINK_MAX_M - 1 }
    expect(twistyRoads(chained([stub, { label: 'CV-383', lengthM: 5_700 }]), 'Unnamed road')).toBeNull()
    expect(twistyRoads(chained([{ label: 'CV-379', lengthM: 16_000 }, stub, { label: 'CV-377', lengthM: 5_000 }]), 'Unnamed road')?.map(({ title }) => title)).toEqual(['CV-379', 'CV-377'])
  })

  it('lists nothing for a twisty on one road, or saved before its roads were kept', () => {
    expect(twistyRoads(chained([{ label: 'AV-901', lengthM: 120_000 }]), 'Unnamed road')).toBeNull()
    expect(twistyRoads(chained(undefined), 'Unnamed road')).toBeNull()
  })
})

describe('twistyCaption', () => {
  const texts = { unnamedRoad: 'Unnamed road', ratingWords: ['Flowing', 'Winding', 'Very winding', 'Twisty', 'Epic'] }
  const km = (meters: number) => (meters / 1000).toFixed(1).replace('.', ',')

  it("reads like the twisty's row: number, road, length and character", () => {
    expect(twistyCaption(2, { ...twisty(2, 4_900), label: 'N-260 · Eje Pirenaico' }, texts, km)).toBe('2 · N-260 · 4,9 km · Winding')
  })

  it('names a road without a name as the list does', () => {
    expect(twistyCaption(1, twisty(5, 12_300), texts, km)).toBe('1 · Unnamed road · 12,3 km · Epic')
  })
})
