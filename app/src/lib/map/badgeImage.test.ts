import { describe, expect, it } from 'vitest'
import { circleSdf } from './badgeImage'

const alphaAt = (image: ReturnType<typeof circleSdf>, x: number, y: number) => image.data[(y * image.width + x) * 4 + 3]

describe('circleSdf', () => {
  const image = circleSdf(11, 4)

  it('is large enough for the circle and its margin', () => {
    expect([image.width, image.height]).toEqual([30, 30])
  })

  it('is opaque inside, at three quarters on the edge and clear far outside', () => {
    expect(alphaAt(image, 15, 15)).toBe(255)
    expect(alphaAt(image, 15 + 11, 15)).toBeGreaterThan(170)
    expect(alphaAt(image, 15 + 11, 15)).toBeLessThan(215)
    expect(alphaAt(image, 0, 0)).toBe(0)
  })

  it('fades by an eighth per pixel outside the edge', () => {
    expect(alphaAt(image, 15 + 13, 15)).toBeLessThan(alphaAt(image, 15 + 11, 15))
  })
})
