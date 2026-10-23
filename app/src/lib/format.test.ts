import { afterEach, describe, expect, it } from 'vitest'
import { formatExtra, formatKm, formatNumber } from './format'
import { i18n } from './i18n/i18n.svelte'

describe('formatting follows the active language', () => {
  afterEach(() => (i18n.locale = 'en'))

  it('uses English separators and words', () => {
    i18n.locale = 'en'
    expect(formatKm(5_430)).toBe('5.4')
    expect(formatNumber(68_123)).toBe('68,123')
    expect(formatExtra(0)).toBe('Fastest')
  })

  it('uses Spanish separators and words', () => {
    i18n.locale = 'es'
    expect(formatKm(5_430)).toBe('5,4')
    expect(formatKm(129_400)).toBe('129')
    expect(formatNumber(68_123)).toBe('68.123')
    expect(formatExtra(0)).toBe('La más rápida')
    expect(formatExtra(64 * 60)).toBe('+1 h 04')
  })
})

describe('number formatters are cached', () => {
  afterEach(() => (i18n.locale = 'en'))

  it('builds one formatter per language and precision', () => {
    const NumberFormat = Intl.NumberFormat
    let built = 0
    Intl.NumberFormat = new Proxy(NumberFormat, {
      construct(target, args) {
        built++
        return Reflect.construct(target, args)
      },
    })
    try {
      i18n.locale = 'en'
      formatNumber(1_234.5, 3)
      formatNumber(9_876.5, 3)
      expect(built).toBe(1)
      formatNumber(1_234.5, 4)
      expect(built).toBe(2)
      i18n.locale = 'es'
      expect(formatNumber(1_234.5, 3)).toBe('1234,500')
      expect(built).toBe(3)
      i18n.locale = 'en'
      expect(formatNumber(1_234.5, 3)).toBe('1,234.500')
      expect(built).toBe(3)
    } finally {
      Intl.NumberFormat = NumberFormat
    }
  })
})
