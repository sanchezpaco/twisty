import { describe, expect, it } from 'vitest'
import { graphBuffer, graphFixture } from '../testing/graphFixture'
import { edgeCoordinates, isUTurn, OneWay, parseGraph, Ride, RoadClass, stackLayer } from './graph'

describe('stackLayer', () => {
  it('continues the node, road and geometry numbering of the graph below', () => {
    const roads = graphFixture(
      [
        [0, 0],
        [1, 0],
      ],
      [{ from: 0, to: 1, timeS: 60, road: 1, geometry: [[0.5, 0]] }],
      ['', 'CV-35'],
    )
    const tracks = graphBuffer(
      [[1, 1]],
      [{ from: 1, to: 2, timeS: 300, road: 2, roadClass: RoadClass.Track, geometry: [[1, 0.5]] }],
      ['Pista del Collado'],
    )
    const graph = stackLayer(roads, tracks)

    expect(graph.nodeCount).toBe(3)
    expect(graph.roadNames).toEqual(['', 'CV-35', 'Pista del Collado'])
    expect(graph.roadNames[graph.edgeRoad[1]]).toBe('Pista del Collado')
    expect(edgeCoordinates(graph, 0, 0)).toEqual([
      [0, 0],
      [0.5, 0],
    ])
    expect(edgeCoordinates(graph, 1, 1)).toEqual([
      [1, 0],
      [1, 0.5],
    ])
    expect([...graph.adjacencyNode.subarray(graph.adjacencyStart[1], graph.adjacencyStart[2])].sort()).toEqual([0, 2])
  })
})

describe('parseGraph', () => {
  it('marks each adjacency slot with the way its edge may be ridden from that node', () => {
    const graph = parseGraph(
      graphBuffer(
        [
          [0, 0],
          [1, 0],
          [2, 0],
          [3, 0],
        ],
        [
          { from: 0, to: 1, timeS: 60 },
          { from: 1, to: 2, timeS: 60, oneway: OneWay.Yes },
          { from: 2, to: 3, timeS: 60, oneway: OneWay.InTown },
        ],
      ),
    )
    const rideAt = (node: number, edge: number) => {
      for (let i = graph.adjacencyStart[node]; i < graph.adjacencyStart[node + 1]; i++) if (graph.adjacencyEdge[i] === edge) return graph.adjacencyRide[i]
    }
    expect([rideAt(0, 0), rideAt(1, 0)]).toEqual([Ride.Out | Ride.In, Ride.Out | Ride.In])
    expect([rideAt(1, 1), rideAt(2, 1)]).toEqual([Ride.Out, Ride.In])
    expect([rideAt(2, 2), rideAt(3, 2)]).toEqual([Ride.Out | Ride.In, Ride.Out | Ride.In])
  })
})

describe('isUTurn', () => {
  // A split road ends at node 1: the carriageway coming in from the south-west (edge 0) and the one going out to the west
  // (edge 1) meet the two-way road east (edge 2) there. From edge 0 onto edge 1 is a turn of 135 deg.
  const splitEnd = (extra: { from: number; to: number; timeS: number; oneway?: number }[] = [], eastOneway?: number) =>
    graphFixture(
      [
        [0.003, -0.007],
        [0.01, 0],
        [0, 0],
        [0.02, 0],
        [0.01, 0.01],
      ],
      [
        { from: 0, to: 1, timeS: 10, oneway: OneWay.Yes },
        { from: 1, to: 2, timeS: 10, oneway: OneWay.Yes },
        { from: 1, to: 3, timeS: 10, oneway: eastOneway },
        ...extra,
      ],
    )

  it('bans a turn one heading step short of U_TURN_DEG, which the drawn line may make at the limit', () => {
    // One carriageway arriving east at node 1, the other leaving it; two two-way roads also meet there, so no split end.
    const turn = (outDeg: number) =>
      graphFixture(
        [
          [-0.01, 0],
          [0, 0],
          [-0.01, 0.006],
          [0, 0.01],
          [0, -0.01],
        ],
        [
          { from: 0, to: 1, timeS: 10, oneway: OneWay.Yes, headings: [0, 0] },
          { from: 1, to: 2, timeS: 10, oneway: OneWay.Yes, headings: [outDeg, outDeg] },
          { from: 1, to: 3, timeS: 10 },
          { from: 1, to: 4, timeS: 10 },
        ],
      )
    expect(isUTurn(turn(149.06), 0, 1, 1)).toBe(true)
    expect(isUTurn(turn(147.66), 0, 1, 1)).toBe(false)
  })

  it('bans turning from one carriageway onto the other where a split road ends, from SPLIT_END_U_TURN_DEG', () => {
    expect(isUTurn(splitEnd(), 0, 1, 1)).toBe(true)
  })

  it('keeps a turn round a tight roundabout, where the road joining it does not leave away from both carriageways', () => {
    const joined = graphFixture(
      [
        [0.003, -0.007],
        [0.01, 0],
        [0, 0],
        [0.01, 0.01],
      ],
      [
        { from: 0, to: 1, timeS: 10, oneway: OneWay.Yes },
        { from: 1, to: 2, timeS: 10, oneway: OneWay.Yes },
        { from: 1, to: 3, timeS: 10 },
      ],
    )
    expect(isUTurn(joined, 0, 1, 1)).toBe(false)
  })

  it('keeps the same turn where more roads meet, or where the third road is one-way too', () => {
    expect(isUTurn(splitEnd([{ from: 1, to: 4, timeS: 10 }]), 0, 1, 1)).toBe(false)
    expect(isUTurn(splitEnd([], OneWay.Yes), 0, 1, 1)).toBe(false)
  })
})
