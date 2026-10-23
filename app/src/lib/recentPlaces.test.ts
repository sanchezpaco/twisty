import { describe, expect, it } from 'vitest'
import type { LonLat } from './geo'
import { RECENT_PLACES_MAX, recentPlaces, SAME_PLACE_M } from './recentPlaces'
import type { SavedRide } from './savedRide'
import type { HistoryPlace, HistoryTrip } from './tripHistory'

const JACA: LonLat = [-0.5498, 42.5698]
const BENASQUE: LonLat = [0.5232, 42.6033]
const AINSA: LonLat = [0.1398, 42.4183]
const GRAUS: LonLat = [0.3375, 42.1886]
const TORLA: LonLat = [-0.1111, 42.6276]
const BIESCAS: LonLat = [-0.3218, 42.6264]

const at = (label: string, position: LonLat): HistoryPlace => ({ label, position })
const trip = (from: HistoryPlace, to: HistoryPlace, when: number, via: HistoryPlace[] = []): HistoryTrip => ({ from, to, via, includeTracks: false, selected: 0, at: when, handed: true })
const saved = (from: LonLat, to: LonLat, when: number): SavedRide =>
  ({ id: String(when), name: 'x', folderId: null, savedAt: when, from: { label: 'Saved from', position: from }, to: { label: 'Saved to', position: to }, via: [], dataAt: null, ride: {} }) as unknown as SavedRide

describe('recentPlaces', () => {
  it('lists the newest trip first, its finish before its start and its stops', () => {
    const history = [trip(at('Jaca', JACA), at('Benasque', BENASQUE), 2, [at('Aínsa', AINSA)]), trip(at('Graus', GRAUS), at('Torla', TORLA), 1)]
    expect(recentPlaces(history, [], []).map((place) => place.label)).toEqual(['Benasque', 'Jaca', 'Aínsa', 'Torla', 'Graus'])
  })

  it('mixes saved rides in by when they were saved', () => {
    const history = [trip(at('Jaca', JACA), at('Benasque', BENASQUE), 1)]
    expect(recentPlaces(history, [saved(GRAUS, TORLA, 2)], []).map((place) => place.label)).toEqual(['Saved to', 'Saved from', 'Benasque', 'Jaca'])
  })

  it('never offers the rider position kept as "here"', () => {
    const history = [trip({ here: true }, at('Benasque', BENASQUE), 1)]
    expect(recentPlaces(history, [], []).map((place) => place.label)).toEqual(['Benasque'])
  })

  it('counts two picks a few metres apart as one place, the newer one', () => {
    const nearJaca: LonLat = [JACA[0] + 0.0005, JACA[1]]
    const history = [trip(at('Jaca centre', nearJaca), at('Benasque', BENASQUE), 2), trip(at('Jaca', JACA), at('Aínsa', AINSA), 1)]
    expect(recentPlaces(history, [], []).map((place) => place.label)).toEqual(['Benasque', 'Jaca centre', 'Aínsa'])
    expect(SAME_PLACE_M).toBe(150)
  })

  it('leaves out the places the trip already has', () => {
    const history = [trip(at('Jaca', JACA), at('Benasque', BENASQUE), 1)]
    expect(recentPlaces(history, [], [JACA]).map((place) => place.label)).toEqual(['Benasque'])
  })

  it('offers at most five', () => {
    const history = [trip(at('Jaca', JACA), at('Benasque', BENASQUE), 3), trip(at('Graus', GRAUS), at('Aínsa', AINSA), 2), trip(at('Biescas', BIESCAS), at('Torla', TORLA), 1)]
    expect(recentPlaces(history, [], [])).toHaveLength(RECENT_PLACES_MAX)
    expect(RECENT_PLACES_MAX).toBe(5)
  })
})
