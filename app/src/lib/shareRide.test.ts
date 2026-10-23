import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from './i18n/i18n.svelte'
import type { RideOption, RideTwisty } from './routing/ride'
import { rideShareText, sharesRiderPosition } from './shareRide'
import { backToStart } from './via'

const LINK = 'https://www.google.com/maps/dir/?api=1&origin=42.57,-0.55&destination=42.6,0.52'

const twisty = (label: string, rating: number, lengthM: number): RideTwisty => ({ label, rating, lengthM, narrowM: 0, postedKmh: null, fordCount: 0, line: [], leg: 0 })

const ride = (over: Partial<RideOption> = {}): RideOption => ({
  edges: [],
  timeS: 2 * 3600 + 35 * 60,
  extraS: 0,
  distanceM: 151_000,
  curvyM: 0,
  twistyM: 56_400,
  motorwayM: 0,
  trackM: 0,
  otherM: 0,
  twisties: [],
  segments: [],
  googleMapsUrl: LINK,
  pinnedAll: true,
  legs: [{ timeS: 2 * 3600 + 35 * 60, distanceM: 151_000, twistyM: 56_400, curvyM: 0 }],
  coverageRoad: null,
  ...over,
})

const text = (option: RideOption) => rideShareText(option, 'Jaca', 'Benasque', i18n.t)

afterEach(() => (i18n.locale = 'en'))

describe('rideShareText', () => {
  it('tells where, how long, how curvy, and ends on the link', () => {
    i18n.locale = 'en'
    expect(text(ride())).toBe(['Jaca → Benasque, planned with Twisty', '2 h 35 · 151 km · 56 km of curves', LINK].join('\n'))
  })

  it('names the stops under the heading, in riding order', () => {
    const lines = rideShareText(ride(), 'València', 'Los Santos', i18n.t, ['Chelva', 'Ademuz']).split('\n')
    expect(lines[1]).toBe('via Chelva, Ademuz')
    expect(text(ride())).not.toContain('via ')
  })

  it('is in the language of the app, with its decimals', () => {
    i18n.locale = 'es'
    expect(text(ride({ distanceM: 9_400, twistyM: 4_200, timeS: 25 * 60 }))).toBe(
      ['Jaca → Benasque, planificada con Twisty', '25 min · 9,4 km · 4,2 km de curvas', LINK].join('\n'),
    )
  })

  it('names at most two roads, the highest rated first and then the longest', () => {
    const twisties = [twisty('A-1605', 3, 9000), twisty('N-260 · Coll de Fadas', 5, 6000), twisty('CV-345', 5, 8000), twisty('GIV-5221', 1, 30_000)]
    const lines = text(ride({ twisties })).split('\n')
    expect(lines[2]).toBe('Curvy roads: CV-345, N-260 · Coll de Fadas')
    expect(lines).toHaveLength(4)
  })

  it('knows a road by its name or by a standard ref, and skips local codes however curvy they are', () => {
    const twisties = [twisty('HF04', 5, 20_000), twisty('SC-22109-01', 5, 15_000), twisty('HU-V-9', 5, 12_000), twisty('', 5, 11_000), twisty('HF04 · Camino viejo', 4, 5000), twisty('A-1605', 2, 4000)]
    expect(text(ride({ twisties })).split('\n')[2]).toBe('Curvy roads: Camino viejo, A-1605')
    for (const ref of ['N-260', 'A-1605', 'CV-345', 'GIV-5221', 'BV-5114', 'C-153', 'AP-7']) {
      expect(text(ride({ twisties: [twisty(ref, 3, 5000)] }))).toContain(`Curvy roads: ${ref}`)
    }
    for (const local of ['HF04', 'SC-22109-01', 'HU-V-9', 'CV-35-A', 'n-260', 'N260']) {
      expect(text(ride({ twisties: [twisty(local, 3, 5000)] }))).not.toContain('Curvy roads')
    }
  })

  it('tells a road by its name alone when its ref is a local code', () => {
    const twisties = [twisty('SC-22221-03 · Carretera de Arasán', 5, 9000), twisty('A-2205', 4, 8000)]
    expect(text(ride({ twisties })).split('\n')[2]).toBe('Curvy roads: Carretera de Arasán, A-2205')
    const olot = [twisty("N-260a · Carretera d'Olot", 5, 9000), twisty('N-260 · Carretera Olot-Ripoll', 4, 8000)]
    expect(text(ride({ twisties: olot })).split('\n')[2]).toBe("Curvy roads: Carretera d'Olot, N-260 · Carretera Olot-Ripoll")
    expect(text(ride({ twisties: [twisty('HF04 · Camino viejo · tramo 2', 3, 5000)] }))).toContain('Curvy roads: Camino viejo · tramo 2')
  })

  it('has no roads line without twisties or when none is known', () => {
    expect(text(ride()).split('\n')).toHaveLength(3)
    expect(text(ride({ twisties: [twisty('', 4, 5000), twisty('HF04', 5, 9000), twisty('SC-22109-01', 2, 9000)] })).split('\n')).toHaveLength(3)
  })

  it('says there are tracks, so whoever opens the link knows', () => {
    const lines = text(ride({ trackM: 3_700 })).split('\n')
    expect(lines.at(-2)).toBe('3.7 km of tracks, may be closed or rough')
    i18n.locale = 'es'
    expect(text(ride({ trackM: 3_700 })).split('\n').at(-2)).toBe('3,7 km de pistas, quizá cerradas o en mal estado')
  })

  it('carries the link once, on the last line, whatever else the ride has', () => {
    for (const option of [ride(), ride({ trackM: 1200, twisties: [twisty('N-260', 5, 5000)] })]) {
      const lines = text(option).split('\n')
      expect(lines.at(-1)).toBe(LINK)
      expect(text(option).split(LINK)).toHaveLength(2)
    }
  })

  it('does not show what the rider traded for it', () => {
    expect(text(ride({ extraS: 43 * 60 }))).not.toMatch(/\+43|43 min/)
  })
})

describe('sharesRiderPosition', () => {
  const here = { label: 'My location', position: [-0.55, 42.57] as [number, number], here: true as const }
  const town = { label: 'Benasque', position: [0.52, 42.6] as [number, number] }

  it('is true for a ride that ends at the rider\'s live position', () => {
    expect(sharesRiderPosition(here)).toBe(true)
  })

  it('is true for a loop back to a start at the rider\'s live position', () => {
    expect(sharesRiderPosition(backToStart(here, 'Back to the start'))).toBe(true)
  })

  it('is false for a ride that ends at a named place, or has no finish yet', () => {
    expect(sharesRiderPosition(town)).toBe(false)
    expect(sharesRiderPosition(null)).toBe(false)
  })
})
