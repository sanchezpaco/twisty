import { describe, expect, it } from 'vitest'
import { regionAt } from './regions'

describe('regionAt', () => {
  it('tells the islands from the mainland', () => {
    expect(regionAt([-16.25, 28.46])).toBe('canaries')
    expect(regionAt([-5.99, 37.39])).toBe('mainland')
    expect(regionAt([2.65, 39.57])).toBe('mainland')
  })
})
