import { describe, expect, it, vi } from 'vitest'
import { runBackHandlers } from './backButton'

describe('runBackHandlers', () => {
  it('lets the newest handler that uses the press have it, and stops there', () => {
    const calls: string[] = []
    const panel = () => (calls.push('panel'), true)
    const sheet = () => (calls.push('sheet'), true)
    expect(runBackHandlers([panel, sheet])).toBe(true)
    expect(calls).toEqual(['sheet'])
  })

  it('goes on to the older handler when the newest does not use the press', () => {
    const panel = vi.fn(() => true)
    expect(runBackHandlers([panel, () => false])).toBe(true)
    expect(panel).toHaveBeenCalledOnce()
  })

  it('says nobody used the press, so the app can close', () => {
    expect(runBackHandlers([() => false, () => false])).toBe(false)
    expect(runBackHandlers([])).toBe(false)
  })
})
