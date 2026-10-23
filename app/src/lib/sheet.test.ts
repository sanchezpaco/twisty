import { describe, expect, it } from 'vitest'
import { cycleSnap, followFinger, releaseVelocity, settleSnap, snapsFor } from './sheet'

const phone = { peekPx: 232, halfPx: 356, contentPx: 1200, viewportPx: 780, topReservePx: 72 }
const snaps = snapsFor(phone)

describe('snapsFor', () => {
  it('offers peek, half and full, full stopping short of the top of the screen', () => {
    expect(snaps).toEqual([
      { name: 'peek', visiblePx: 232 },
      { name: 'half', visiblePx: 356 },
      { name: 'full', visiblePx: 708 },
    ])
  })

  it('never shows empty space under short content', () => {
    expect(snapsFor({ ...phone, contentPx: 300 }).map((snap) => snap.visiblePx)).toEqual([232, 300])
  })

  it('drops the middle snap when the content barely exceeds it', () => {
    expect(snapsFor({ ...phone, contentPx: 370 }).map((snap) => snap.name)).toEqual(['peek', 'full'])
  })

  it('has a single snap when the content is smaller than the peek', () => {
    expect(snapsFor({ ...phone, contentPx: 200 })).toEqual([{ name: 'full', visiblePx: 200 }])
  })
})

describe('followFinger', () => {
  it('follows the finger one to one between the snaps', () => {
    expect(followFinger(500, snaps)).toBe(500)
  })

  it('resists past the ends and gives at most 48 px', () => {
    expect(followFinger(708 + 100, snaps)).toBeCloseTo(708 + 35)
    expect(followFinger(708 + 1000, snaps)).toBe(708 + 48)
    expect(followFinger(232 - 100, snaps)).toBeCloseTo(232 - 35)
  })
})

describe('releaseVelocity', () => {
  it('uses only the last 100 ms of the drag', () => {
    const samples = [
      { timeMs: 0, visiblePx: 356 },
      { timeMs: 400, visiblePx: 300 },
      { timeMs: 450, visiblePx: 310 },
      { timeMs: 500, visiblePx: 330 },
    ]
    expect(releaseVelocity(samples)).toBeCloseTo(0.3)
  })

  it('is zero without movement or samples', () => {
    expect(releaseVelocity([])).toBe(0)
    expect(releaseVelocity([{ timeMs: 10, visiblePx: 300 }])).toBe(0)
  })
})

describe('settleSnap', () => {
  it('goes to the next snap past where the drag began, in the direction of a flick', () => {
    expect(settleSnap(snaps, 356, 380, 0.5).name).toBe('full')
    expect(settleSnap(snaps, 356, 340, 0.5).name).toBe('full')
    expect(settleSnap(snaps, 356, 330, -0.5).name).toBe('peek')
    expect(settleSnap(snaps, 356, 400, -0.5).name).toBe('peek')
  })

  it('goes past the finger when it already went further than the next snap', () => {
    expect(settleSnap(snaps, 232, 400, 0.5).name).toBe('full')
  })

  it('stays within the first and last snap', () => {
    expect(settleSnap(snaps, 708, 700, 2).name).toBe('full')
    expect(settleSnap(snaps, 232, 240, -2).name).toBe('peek')
  })

  it('takes the nearest snap after a slow drag', () => {
    expect(settleSnap(snaps, 356, 280, 0.1).name).toBe('peek')
    expect(settleSnap(snaps, 232, 300, 0.1).name).toBe('half')
    expect(settleSnap(snaps, 708, 560, -0.2).name).toBe('full')
  })
})

describe('cycleSnap', () => {
  it('climbs one snap per tap and comes back down from the top', () => {
    expect(cycleSnap(snaps, 'peek').name).toBe('half')
    expect(cycleSnap(snaps, 'half').name).toBe('full')
    expect(cycleSnap(snaps, 'full').name).toBe('half')
  })

  it('toggles between the two snaps of a short sheet', () => {
    const two = snapsFor({ ...phone, contentPx: 300 })
    expect(cycleSnap(two, 'peek').name).toBe('full')
    expect(cycleSnap(two, 'full').name).toBe('peek')
  })
})
