import { describe, expect, it } from 'vitest'
import type { LonLat } from './geo'
import { backToStart, distinctStops, dropIndex, endAtStop, insertionIndex, isLoop, moveVia, withoutStopAt } from './via'

describe('a loop back to the start', () => {
  it('finishes at the start, still "here" when the start is the rider\'s position', () => {
    const here = { label: 'My location', position: [-0.9, 41.6] as LonLat, here: true as const }
    expect(backToStart(here, 'Back to the start')).toEqual({ ...here, detail: 'Back to the start' })
    expect(backToStart({ label: 'Jaca', position: [-0.55, 42.57] }, 'Back')).not.toHaveProperty('here')
  })

  it('is a loop when the finish is the start, or a few metres from it', () => {
    expect(isLoop([-0.3763, 39.4699], [-0.3763, 39.4699])).toBe(true)
    expect(isLoop([-0.3763, 39.4699], [-0.3762, 39.4700])).toBe(true)
    expect(isLoop([-0.3763, 39.4699], [-0.3763, 39.48])).toBe(false)
  })
})

describe('moving a stop', () => {
  it('takes it out and puts it at its new place', () => {
    expect(moveVia(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveVia(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveVia(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })

  it('keeps it in the list past either end', () => {
    expect(moveVia(['a', 'b'], 0, 9)).toEqual(['b', 'a'])
    expect(moveVia(['a', 'b'], 1, -3)).toEqual(['b', 'a'])
  })
})

describe('a stop dropped on the map', () => {
  const valencia: LonLat = [-0.376, 39.47]
  const teruel: LonLat = [-1.106, 40.345]
  const segorbe: LonLat = [-0.489, 39.851]

  it('goes where it lengthens the trip least', () => {
    // València → Teruel: Segorbe lies on the way.
    expect(insertionIndex([valencia, teruel], segorbe)).toBe(0)
    // Teruel → València → Segorbe: a point just south of Segorbe belongs between València and Segorbe.
    expect(insertionIndex([teruel, valencia, segorbe], [-0.47, 39.8])).toBe(1)
  })
})

describe('stops that make no leg', () => {
  const place = (label: string, lon: number) => ({ label, position: [lon, 40] as LonLat })
  const a = place('A', 0)
  const b = place('B', 1)
  const c = place('C', 2)

  it('drop a stop on the place before it, or on the finish', () => {
    expect(distinctStops(a, [a, b], c).map((p) => p.label)).toEqual(['B'])
    expect(distinctStops(a, [b, b], c).map((p) => p.label)).toEqual(['B'])
    expect(distinctStops(a, [b, c], c).map((p) => p.label)).toEqual(['B'])
  })

  it('keep a loop: the finish may be the start once a stop lies between', () => {
    expect(distinctStops(a, [b], a).map((p) => p.label)).toEqual(['B'])
  })
})

describe('a stop dropped among the others', () => {
  // Three stops 56 px apart, their middles at 100, 156 and 212.
  const middles = [100, 156, 212]

  it('lands where the finger is, wherever on the grip it was taken', () => {
    for (const grab of [-6, 0, 6]) {
      expect(dropIndex(middles, 0, 156 + 20 + grab)).toBe(1)
      expect(dropIndex(middles, 1, 100 - 20 + grab)).toBe(0)
      expect(dropIndex(middles, 0, 212 + 20 + grab)).toBe(2)
    }
  })

  it('moves one row for a drag of exactly one row, either way', () => {
    expect(dropIndex(middles, 0, 156)).toBe(1)
    expect(dropIndex(middles, 1, 100)).toBe(0)
    expect(dropIndex(middles, 0, 212)).toBe(2)
  })

  it('stays put when the finger has not passed a neighbour', () => {
    expect(dropIndex(middles, 1, 150)).toBe(1)
    expect(dropIndex(middles, 1, 170)).toBe(1)
  })

  it('moves the list as the drop says', () => {
    const stops = ['Biescas', 'Broto', 'Aínsa']
    expect(moveVia(stops, 0, dropIndex(middles, 0, 180))).toEqual(['Broto', 'Biescas', 'Aínsa'])
    expect(moveVia(stops, 2, dropIndex(middles, 2, 90))).toEqual(['Aínsa', 'Biescas', 'Broto'])
  })
})

describe('a stop tapped on the map', () => {
  const stop = (label: string, position: LonLat) => ({ label, position })
  const ainsa = stop('Aínsa', [0.1398, 42.4183])
  const graus = stop('Graus', [0.3375, 42.1886])
  const torla = stop('Torla', [-0.1111, 42.6276])

  it('removes every stop on that point, as the map draws them as one', () => {
    expect(withoutStopAt([ainsa, graus, { ...graus }, torla], graus.position)).toEqual([ainsa, torla])
  })

  it('ends the trip there: the stops before it stay, the ones after go with the old finish', () => {
    expect(endAtStop([ainsa, graus, torla], graus.position)).toEqual({ via: [ainsa], to: graus })
  })

  it('does nothing for a point with no stop', () => {
    expect(endAtStop([ainsa], graus.position)).toBeNull()
  })
})
