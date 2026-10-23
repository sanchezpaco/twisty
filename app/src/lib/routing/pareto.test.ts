import { describe, expect, it } from 'vitest'
import { paretoFrontier, paretoSum } from './pareto'

const option = (timeS: number, score: number, twistyM = score) => ({ timeS, score, twistyM })

describe('paretoFrontier', () => {
  it('drops options that are slower and less twisty than another', () => {
    const frontier = paretoFrontier([option(100, 0), option(200, 10), option(250, 5), option(300, 30), option(150, 0)])
    expect(frontier).toEqual([option(100, 0), option(200, 10), option(300, 30)])
  })
})

describe('paretoSum', () => {
  it('folded leg by leg, is the frontier of every whole ride', () => {
    let seed = 11
    const random = () => ((seed = (seed * 16_807) % 2_147_483_647) / 2_147_483_647)
    const join = (a: { timeS: number; score: number; parts: number[] }, b: { timeS: number; score: number }, part: number) => ({
      timeS: a.timeS + b.timeS,
      score: a.score + b.score,
      parts: [...a.parts, part],
    })
    for (let trial = 0; trial < 20; trial++) {
      const legs = Array.from({ length: 3 }, () => paretoFrontier(Array.from({ length: 8 }, () => option(Math.round(random() * 100), Math.round(random() * 50)))))
      const latestS = 180
      const start = [{ timeS: 0, score: 0, parts: [] as number[] }]
      const folded = legs.reduce((whole, leg) => paretoSum(whole, leg.map((ride, i) => ({ ...ride, i })), (a, b) => join(a, b, b.i), latestS), start)
      const every = legs.reduce((whole, leg) => whole.flatMap((a) => leg.map((ride, i) => join(a, ride, i))), start).filter((ride) => ride.timeS <= latestS)
      expect(folded.map(({ timeS, score }) => [timeS, score])).toEqual(paretoFrontier(every).map(({ timeS, score }) => [timeS, score]))
    }
  })
})
