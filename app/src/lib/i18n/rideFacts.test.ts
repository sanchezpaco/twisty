import { describe, expect, it } from 'vitest'
import { en } from './en'
import { es } from './es'

describe('rideFacts', () => {
  it('names the roads that close, or speaks of some roads when it cannot', () => {
    expect(en.ride.rideFacts(0, true, ['Ma-2210'])).toBe('Closed to traffic part of the year: Ma-2210.')
    expect(en.ride.rideFacts(1, true, ['Ma-2210', 'CV-345'])).toBe('This ride crosses one ford. Closed to traffic part of the year: Ma-2210 and CV-345.')
    expect(en.ride.rideFacts(2, true, [])).toBe('This ride crosses 2 fords, and some of its roads close to traffic part of the year.')
    expect(en.ride.rideFacts(0, true, [])).toBe('Some roads on this ride close to traffic part of the year.')
    expect(en.ride.rideFacts(3, false, [])).toBe('This ride crosses 3 fords.')
  })

  it('says it in Spanish for a ref or a name alike', () => {
    expect(es.ride.rideFacts(0, true, ['Ma-2210'])).toBe('Cerrada al tráfico parte del año: Ma-2210.')
    expect(es.ride.rideFacts(1, true, ['Ma-2210', 'Camino rural de Riaza'])).toBe(
      'Esta ruta cruza un vado. Cerradas al tráfico parte del año: Ma-2210 y Camino rural de Riaza.',
    )
    expect(es.ride.rideFacts(2, true, [])).toBe('Esta ruta cruza 2 vados y algunas de sus carreteras cierran al tráfico parte del año.')
    expect(es.ride.rideFacts(0, true, [])).toBe('Algunas carreteras de esta ruta cierran al tráfico parte del año.')
  })
})
