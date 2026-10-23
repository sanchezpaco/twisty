import { describe, expect, it } from 'vitest'
import { nodePosition, OneWay, RoadClass } from '../data/graph'
import { haversineM } from '../geo'
import { graphFixture } from '../testing/graphFixture'
import { NodeLocator } from './nodeLocator'

// A town street (nodes 0-1), a motorway (2-3), a track (4-5) and a distant village street (6-7).
const graph = graphFixture(
  [
    [-3.7, 40.4],
    [-3.69, 40.4],
    [-3.7, 40.41],
    [-3.69, 40.41],
    [-3.7, 40.42],
    [-3.69, 40.42],
    [-3.0, 41.0],
    [-3.01, 41.0],
  ],
  [
    { from: 0, to: 1, timeS: 10 },
    { from: 2, to: 3, timeS: 10, roadClass: RoadClass.Motorway },
    { from: 4, to: 5, timeS: 10, roadClass: RoadClass.Track },
    { from: 6, to: 7, timeS: 10 },
  ],
)

describe('NodeLocator', () => {
  const locator = new NodeLocator(graph)

  it('snaps to the nearest node of a street, across cell borders', () => {
    expect(locator.nearest([-3.6919, 40.4001])).toBe(1)
    expect(locator.nearest([-3.0105, 41.0005])).toBe(7)
  })

  it('never starts on a motorway or a track, even when they are closest', () => {
    expect(locator.nearest([-3.7, 40.4101])).not.toBe(2)
    expect(locator.nearest([-3.7, 40.4199])).not.toBe(4)
    expect(nodePosition(graph, locator.nearest([-3.7, 40.4199]))[1]).toBe(Math.fround(40.4))
  })

  it('never starts on a node of one-way streets only', () => {
    // A one-way street 2-3 next to the town street: its nodes are skipped for the street's.
    const withOneWay = graphFixture(
      [
        [-3.7, 40.4],
        [-3.69, 40.4],
        [-3.7, 40.401],
        [-3.69, 40.401],
      ],
      [
        { from: 0, to: 1, timeS: 10 },
        { from: 2, to: 3, timeS: 10, oneway: OneWay.Yes },
      ],
    )
    expect(new NodeLocator(withOneWay).nearest([-3.69, 40.4009])).toBe(1)
  })

  it('finds nothing beyond walking reach, including outside the mapped area', () => {
    expect(locator.nearest([-3.0, 42.5])).toBe(-1)
    expect(locator.nearest([10, 10])).toBe(-1)
  })

  it('agrees with a brute-force search', () => {
    const streets = [0, 1, 6, 7]
    for (let lon = -3.75; lon < -2.95; lon += 0.037) {
      for (let lat = 40.35; lat < 41.05; lat += 0.041) {
        const nearest = streets
          .map((node) => ({ node, d: haversineM([lon, lat], nodePosition(graph, node)) }))
          .reduce((a, b) => (b.d < a.d ? b : a))
        expect(locator.nearest([lon, lat])).toBe(nearest.d < 15_000 ? nearest.node : -1)
      }
    }
  })
})
