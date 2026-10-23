import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { i18n } from '../lib/i18n/i18n.svelte'
import { TRACKS_OFFERED } from '../lib/offRoad'
import type { HistoryTrip } from '../lib/tripHistory'
import RecentTrips from './RecentTrips.svelte'

const trip = (includeTracks: boolean): HistoryTrip => ({
  from: { label: 'Jaca', position: [-0.5494, 42.5693] },
  to: { label: 'Benasque', position: [0.5237, 42.6053] },
  via: [],
  includeTracks,
  selected: 2,
  at: Date.now(),
  handed: true,
})

const html = (trips: HistoryTrip[]) => render(RecentTrips, { props: { trips, onpick: () => {}, onremove: () => {}, onclear: () => {} } }).body

describe('RecentTrips', () => {
  // The trip is planned on roads while tracks are not offered, so the list must not promise them.
  it('names the stops of a trip on its second line', () => {
    const viaPanticosa = { ...trip(false), via: [{ label: 'Panticosa', position: [-0.28, 42.72] as [number, number] }] }
    expect(html([viaPanticosa])).toContain(i18n.t.via.through('Panticosa'))
  })

  it('tags a trip with tracks only while tracks are offered', () => {
    expect(html([trip(true)]).includes(i18n.t.history.withTracks)).toBe(TRACKS_OFFERED)
    expect(html([trip(false)])).not.toContain(i18n.t.history.withTracks)
  })
})
