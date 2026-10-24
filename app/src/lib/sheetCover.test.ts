import { describe, expect, it } from 'vitest'
import { CONTROLS_CLEARANCE_PX, reachesControls } from './sheetCover.svelte'

describe('the sheet reaching the map controls', () => {
  it('leaves them alone at the middle snap, well below them', () => {
    expect(reachesControls(420, 780, 120)).toBe(false)
  })

  it('reaches them when its top edge comes within the clearance of their bottom', () => {
    expect(reachesControls(780 - 120 - CONTROLS_CLEARANCE_PX, 780, 120)).toBe(true)
    expect(reachesControls(780 - 120 - CONTROLS_CLEARANCE_PX - 1, 780, 120)).toBe(false)
  })

  it('never reaches controls not measured yet', () => {
    expect(reachesControls(780, 780, 0)).toBe(false)
  })
})
