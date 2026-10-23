import { describe, expect, it } from 'vitest'
import { contrast, deltaE, hue, lightness, over } from './colors'

describe('colour maths', () => {
  it('measures WCAG contrast', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
    expect(contrast('#e6ebf5', '#e6ebf5')).toBe(1)
  })

  it('blends a colour over another by its opacity and alpha', () => {
    expect(over('#000000', 0.5, '#ffffff')).toBe('#808080')
    expect(over('rgba(0, 0, 0, 0.5)', 1, '#ffffff')).toBe('#808080')
  })

  it('measures hue in degrees, around the wheel', () => {
    expect(hue('#ff0000')).toBeGreaterThan(30)
    expect(hue('#ff0000')).toBeLessThan(50)
    expect(Math.abs(hue('#00ff00') - hue('#ff0000'))).toBeGreaterThan(90)
  })

  it('measures lightness in CIE L*', () => {
    expect(lightness('#000000')).toBeCloseTo(0, 1)
    expect(lightness('#ffffff')).toBeCloseTo(100, 1)
  })

  // A red and a green are far apart; a deuteranope sees them closer; two near greys are almost the same colour.
  it('tells a red from a green far more than two close greys, and less for a deuteranope', () => {
    const normal = deltaE('#d62d20', '#2e9a3a')
    expect(normal).toBeGreaterThan(40)
    expect(deltaE('#d62d20', '#2e9a3a', 'deutan')).toBeLessThan(normal)
    expect(deltaE('#808080', '#828282')).toBeLessThan(2)
  })
})
