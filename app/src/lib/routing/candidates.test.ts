import { describe, expect, it, vi } from 'vitest'
import { graphFixture } from '../testing/graphFixture'
import { candidatesOfDownload, findCandidates, parseCandidates, serialiseCandidates } from './candidates'
import { buildLegTable } from './legs'

const nodes: [number, number][] = [0, 1, 2, 3, 4, 5].map((i) => [i * 0.01, 0])
const curvy = (from: number, to: number, road = 1, lengthM = 4_000) => ({ from, to, timeS: 300, lengthM, funM: lengthM * 0.9, road })
const dull = (from: number, to: number, road = 2) => ({ from, to, timeS: 100, lengthM: 4_000, funM: 0, road })

describe('findCandidates', () => {
  it('follows a curvy road through a junction where only a dull side road leaves it', () => {
    const graph = graphFixture(nodes, [curvy(0, 1), curvy(1, 2), curvy(2, 3), dull(1, 4)], ['', 'CV-35', 'side'])
    const [road, ...others] = findCandidates(graph)
    expect(others).toHaveLength(0)
    expect(road.ends.toSorted()).toEqual([0, 3])
    expect(road.lengthM).toBe(12_000)
    expect(road.edges).toHaveLength(3)
  })

  it('stops where two other curvy edges of the road leave a node', () => {
    const graph = graphFixture(nodes, [curvy(0, 1), curvy(1, 2), curvy(1, 3)], ['', 'CV-35'])
    expect(findCandidates(graph)).toHaveLength(3)
  })

  it('is one road across a change of name where nothing else meets, and across a short dull edge', () => {
    const renamed = graphFixture(nodes, [curvy(0, 1, 1), curvy(1, 2, 2)], ['', 'BV-5301', 'BV-5301 · Carretera del Montseny'])
    expect(findCandidates(renamed)).toHaveLength(1)
    const bridge = { from: 1, to: 2, timeS: 10, lengthM: 30, funM: 0, road: 3 }
    const bridged = graphFixture(nodes, [curvy(0, 1), bridge, curvy(2, 3)], ['', 'BV-5301', '', 'Pont'])
    expect(findCandidates(bridged).map((road) => road.ends.toSorted())).toEqual([[0, 3]])
  })

  it('does not end a road on a dull edge', () => {
    const [road] = findCandidates(graphFixture(nodes, [curvy(0, 1), curvy(1, 2), dull(2, 3, 1)], ['', 'CV-35']))
    expect(road.ends.toSorted()).toEqual([0, 2])
  })

  it('leaves out roads shorter than a twisty', () => {
    expect(findCandidates(graphFixture(nodes, [curvy(0, 1, 1, 2_000)], ['', 'CV-35']))).toEqual([])
  })

  it('joins the two sides of an unnamed road only where nothing else meets', () => {
    const through = graphFixture(nodes, [curvy(0, 1, 0), curvy(1, 2, 0)], [''])
    expect(findCandidates(through)).toHaveLength(1)
    const junction = graphFixture(nodes, [curvy(0, 1, 0), curvy(1, 2, 0), dull(1, 3)], [''])
    expect(findCandidates(junction).map((road) => road.edges.length)).toEqual([1, 1])
  })
})

const fileOf = (graph: ReturnType<typeof graphFixture>) => serialiseCandidates(graph, findCandidates(graph), buildLegTable(graph, findCandidates(graph)))

describe('candidates file', () => {
  const graph = graphFixture(nodes, [curvy(0, 1), curvy(1, 2), curvy(3, 4, 2), curvy(4, 5, 2)], ['', 'CV-35', 'CV-345'])
  const file = () => fileOf(graph)
  const [nodeCountWord, edgeCountWord] = [2, 3]
  const withWord = (word: number, value: number) => {
    const copy = file()
    new Uint32Array(copy)[word] = value
    return copy
  }

  it('gives back what it was made of, with the legs between the ends', () => {
    const found = findCandidates(graph)
    expect(found).toHaveLength(2)
    expect(parseCandidates(graph, file())).toEqual({ candidates: found, legs: buildLegTable(graph, found) })
  })

  it('refuses another file', () => {
    expect(() => parseCandidates(graph, new ArrayBuffer(16))).toThrow(/Unexpected candidates file/)
    expect(() => parseCandidates(graph, new ArrayBuffer(2))).toThrow(/Unexpected candidates file/)
  })

  it('refuses a file made from a graph with other counts', () => {
    expect(() => parseCandidates(graph, withWord(nodeCountWord, graph.nodeCount + 1))).toThrow(/another graph/)
    expect(() => parseCandidates(graph, withWord(edgeCountWord, graph.edgeCount - 1))).toThrow(/another graph/)
  })

  it('refuses a file of the wrong length', () => {
    expect(() => parseCandidates(graph, file().slice(0, -4))).toThrow(/expected/)
    expect(() => parseCandidates(graph, file().slice(0, 10))).toThrow(/Truncated/)
  })

  it('refuses an edge or a node that is not in the graph', () => {
    const words = new Uint32Array(file())
    const firstEdge = 4 + words[1] * 3 + 1
    const edge = file()
    new Uint32Array(edge)[firstEdge] = graph.edgeCount
    expect(() => parseCandidates(graph, edge)).toThrow(/outside the graph/)
    const end = file()
    new Uint32Array(end)[4 + 3] = graph.nodeCount
    expect(() => parseCandidates(graph, end)).toThrow(/outside the graph/)
  })
})

describe('candidatesOfDownload', () => {
  const graph = graphFixture(nodes, [curvy(0, 1), curvy(1, 2)], ['', 'CV-35'])

  it('uses the file of this graph', () => {
    const onMismatch = vi.fn()
    const found = candidatesOfDownload(graph, fileOf(graph), onMismatch)
    expect(found?.candidates).toEqual(findCandidates(graph))
    expect(onMismatch).not.toHaveBeenCalled()
  })

  it('takes a page served in place of a missing file for no file, quietly', () => {
    const onMismatch = vi.fn()
    const page = new TextEncoder().encode('<!doctype html><html><body>Twisty</body></html>').buffer
    expect(candidatesOfDownload(graph, page, onMismatch)).toBeUndefined()
    expect(candidatesOfDownload(graph, new ArrayBuffer(0), onMismatch)).toBeUndefined()
    expect(onMismatch).not.toHaveBeenCalled()
  })

  it('reports a file of another graph and goes without', () => {
    const other = graphFixture(nodes.slice(0, 4), [curvy(0, 1), curvy(1, 2), curvy(2, 3)], ['', 'CV-35'])
    const onMismatch = vi.fn()
    expect(candidatesOfDownload(graph, fileOf(other), onMismatch)).toBeUndefined()
    expect(onMismatch).toHaveBeenCalledOnce()
    expect(onMismatch.mock.calls[0][0].message).toMatch(/another graph/)
  })
})
