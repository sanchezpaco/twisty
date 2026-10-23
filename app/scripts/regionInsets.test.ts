import { describe, expect, it } from 'vitest'
import { chain, insetSvg, simplify } from './regionInsets'

describe('simplify', () => {
  it('drops the points within the tolerance and keeps the ends', () => {
    expect(simplify([[0, 0], [1, 0.1], [2, 0], [3, 2]], 0.5)).toEqual([[0, 0], [2, 0], [3, 2]])
  })
})

describe('chain', () => {
  it('joins the ways of a coast end to start, whatever their order', () => {
    const chains = chain([
      [[2, 0], [3, 0]],
      [[0, 0], [1, 0]],
      [[1, 0], [2, 0]],
    ])
    expect(chains).toEqual([[[0, 0], [1, 0], [2, 0], [3, 0]]])
  })

  it('closes a loop once', () => {
    expect(chain([[[0, 0], [1, 0]], [[1, 0], [1, 1], [0, 0]]])).toEqual([[[0, 0], [1, 0], [1, 1], [0, 0]]])
  })
})

describe('insetSvg', () => {
  const picture = {
    bounds: [[0, 0], [1, 1]] as [[number, number], [number, number]],
    coast: [[[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.1]]] as [number, number][][],
    coastColor: '#7d869a',
    ramp: ['#1', '#2', '#3', '#4', '#5'],
    minRoadLength: 10,
  }

  it('draws each rating in its colour and leaves out roads too short to see', () => {
    const svg = insetSvg({ ...picture, roads: [{ rating: 5, line: [[0.1, 0.5], [0.9, 0.5]] }, { rating: 2, line: [[0.5, 0.5], [0.51, 0.5]] }] })
    expect(svg).toContain('stroke="#5"')
    expect(svg).not.toContain('stroke="#2"')
    expect(svg).toContain('stroke="#7d869a"')
  })
})
