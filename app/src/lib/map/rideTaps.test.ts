import { describe, expect, it } from 'vitest'
import { BADGE_LAYER } from './layers'
import { tappedTwisty } from './rideTaps'

const badge = (index: number) => ({ layer: { id: BADGE_LAYER }, properties: { index, rating: 3 } })
const line = (twisty?: number) => ({ layer: { id: 'route-twisty-glow' }, properties: { kind: twisty ? 'twisty' : 'transit', ...(twisty && { twisty }) } })

describe('a tap on the ride', () => {
  it('finds the twisty of the badge it landed on', () => {
    expect(tappedTwisty([badge(3)])).toBe(3)
  })

  it('finds the twisty of the line it landed on', () => {
    expect(tappedTwisty([line(2)])).toBe(2)
  })

  it('takes the badge over the line under it, which may be another twisty', () => {
    expect(tappedTwisty([line(1), badge(2)])).toBe(2)
  })

  it('finds nothing off the twisties', () => {
    expect(tappedTwisty([line()])).toBeNull()
    expect(tappedTwisty([])).toBeNull()
  })
})
