/// <reference lib="webworker" />
import { type Graph, parseGraph, stackLayer } from '../data/graph'
import { PlanningError } from '../errors'
import { type CandidateFile, candidatesOfDownload } from '../routing/candidates'
import { Planner } from '../routing/planner'
import type { PlannerRequest, PlannerResponse } from './messages'

const DATA_URL = `${import.meta.env.BASE_URL}data/`

let planner: Promise<Planner> | null = null
// Tracks are a large download, fetched the first time a rider asks for them; the stacked graph then serves both modes.
let tracksStacked = false

const post = (message: PlannerResponse) => self.postMessage(message)

self.onmessage = async ({ data: request }: MessageEvent<PlannerRequest>) => {
  try {
    const ready = await plannerFor(request.type === 'plan' && request.includeTracks)
    if (request.type !== 'plan') return
    const { points, includeTracks, startIsRider } = request
    const options = ready.plan(points, { includeTracks, startIsRider }, (option) => post({ type: 'fastest', id: request.id, option }))
    post({ type: 'planned', id: request.id, options })
  } catch (error) {
    if (!(error instanceof PlanningError)) console.error(error)
    const [code, at] = error instanceof PlanningError ? [error.code, error.at] : (['unexpected', {}] as const)
    post({ type: 'failed', id: request.type === 'plan' ? request.id : undefined, code, ...at })
  }
}

function plannerFor(includeTracks: boolean): Promise<Planner> {
  planner ??= loadPlanner()
  if (includeTracks && !tracksStacked) {
    tracksStacked = true
    const roadsOnly = planner
    planner = roadsOnly.then(stackTracks).catch((error) => {
      tracksStacked = false
      planner = roadsOnly
      throw error
    })
  }
  return planner
}

async function loadPlanner(): Promise<Planner> {
  const graph = parseGraph(await fetchWithProgress(`${DATA_URL}graph.bin`))
  const file = await fetchCandidates(graph)
  const result = new Planner(graph, file?.candidates, file?.legs)
  post({ type: 'ready' })
  return result
}

async function stackTracks(roadsOnly: Planner): Promise<Planner> {
  const response = await fetch(`${DATA_URL}tracks.bin`)
  if (!response.ok) throw new PlanningError('tracksDownload')
  return new Planner(stackLayer(roadsOnly.graph, await response.arrayBuffer()), roadsOnly.allCandidates(), roadsOnly.allLegs())
}

/** Found beforehand at build time; a planner without them, or with a file that is not of this graph, finds them when it first plans. */
async function fetchCandidates(graph: Graph): Promise<CandidateFile | undefined> {
  const response = await fetch(`${DATA_URL}candidates.bin`)
  if (!response.ok) return undefined
  return candidatesOfDownload(graph, await response.arrayBuffer(), (error) => console.warn(`candidates.bin ignored: ${error.message}`))
}

async function fetchWithProgress(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`Could not download ${url} (${response.status})`)
  const totalBytes = Number(response.headers.get('content-length')) || 0
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loadedBytes = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loadedBytes += value.length
    post({ type: 'progress', loadedBytes, totalBytes })
  }
  const bytes = new Uint8Array(loadedBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes.buffer
}
