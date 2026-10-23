import { describe, expect, it } from 'vitest'
import { OneWay } from '../data/graph'
import { graphFixture } from '../testing/graphFixture'
import type { Candidate } from './candidates'
import { buildLegTable, type LegTable, legTableAt, legWords } from './legs'

//  0 ~~~ 1 --one-way--> 2 ~~~ 3     two twisty roads (0-1 and 2-3) joined by a one-way street from 1 to 2,
//         \____ 4 ____/              and a slow way back from 2 to 1 through 4
const graph = graphFixture(
  [
    [0, 0],
    [0.01, 0],
    [0.02, 0],
    [0.03, 0],
    [0.015, 0.01],
  ],
  [
    { from: 0, to: 1, timeS: 300, lengthM: 4_000, funM: 3_600, road: 1 },
    { from: 1, to: 2, timeS: 60, lengthM: 800, funM: 100, oneway: OneWay.Yes },
    { from: 2, to: 3, timeS: 300, lengthM: 4_000, funM: 3_600, road: 2 },
    { from: 2, to: 4, timeS: 400, lengthM: 1_000 },
    { from: 4, to: 1, timeS: 400, lengthM: 1_000 },
  ],
  ['', 'CV-1', 'CV-2'],
)
const roads: Candidate[] = [
  { edges: [0], ends: [0, 1], lengthM: 4_000, funM: 3_600 },
  { edges: [2], ends: [2, 3], lengthM: 4_000, funM: 3_600 },
]
const leg = (table: LegTable, from: number, to: number) => {
  const [a, b] = [table.ends.indexOf(from), table.ends.indexOf(to)]
  for (let i = table.start[a]; i < table.start[a + 1]; i++) {
    if (table.target[i] === b) return { timeS: table.timeS[i], funM: table.funM[i] }
  }
  return undefined
}

describe('buildLegTable', () => {
  it('holds the fastest legal way from each end to the others, which a one-way street makes differ by direction', () => {
    const table = buildLegTable(graph, roads)
    expect([...table.ends]).toEqual([0, 1, 2, 3])
    expect(leg(table, 1, 2)).toEqual({ timeS: 60, funM: 100 })
    expect(leg(table, 2, 1)).toEqual({ timeS: 800, funM: 0 })
  })

  it('leaves out the legs longer than its radius', () => {
    const table = buildLegTable(graph, roads, 600)
    expect(leg(table, 1, 2)).toBeDefined()
    expect(leg(table, 2, 1)).toBeUndefined()
  })

  it('reads back from its words', () => {
    const table = buildLegTable(graph, roads)
    const words = legWords(table)
    const file = new Uint32Array(words.length + 3)
    file.set(words, 3)
    expect(legTableAt(file.buffer, 3, graph.nodeCount)).toEqual(table)
    expect(() => legTableAt(file.buffer.slice(0, -4), 3, graph.nodeCount)).toThrow(/expected/)
  })
})
