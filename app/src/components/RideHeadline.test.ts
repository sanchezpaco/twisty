import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { formatExtra, formatKm } from '../lib/format'
import { i18n } from '../lib/i18n/i18n.svelte'
import type { RideOption } from '../lib/routing/ride'
import RideHeadline from './RideHeadline.svelte'

const ride = { timeS: 9300, distanceM: 149_000, extraS: 2640, twistyM: 56_000 } as RideOption
const html = (saved: boolean) => render(RideHeadline, { props: { ride, fastestTwistyM: 20_000, saved } }).body

describe('RideHeadline', () => {
  it('trades minutes for curves on a planned ride', () => {
    expect(html(false)).toContain(formatExtra(ride.extraS))
    expect(html(false)).toContain(i18n.t.ride.curvesGained(formatKm(36_000)))
  })

  // A saved ride has no fastest option on screen to compare with: its own curves stay the headline's number.
  it('says a saved ride’s own curves instead', () => {
    expect(html(true)).toContain(i18n.t.saved.curves(formatKm(ride.twistyM)))
    expect(html(true)).not.toContain(formatExtra(ride.extraS))
  })
})
