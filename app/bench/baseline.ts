import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { TripResult } from './results'

/** First line of `baseline.jsonl`: what the baseline was measured on. */
export interface BaselineHeader {
  commit: string
  dataHash: string
  /** The extract and graph size, which do not change when a build only renumbers the graph. */
  data: { source: string; nodes: number; edges: number }
  tripsHash: string
  roadsHash: string
  createdAt: string
  /** Where each known road was in the graph. */
  roads: Record<string, { located: boolean; deadEnd: boolean }>
  /** Violations someone let through, with the reason. */
  accepted: { check: string; trip: string; reason: string; commit: string }[]
}

export interface Baseline {
  header: BaselineHeader
  results: Map<string, TripResult>
}

export function readBaseline(path: string): Baseline | null {
  if (!existsSync(path)) return null
  const [first, ...lines] = readFileSync(path, 'utf8').trim().split('\n')
  const results = lines.map((line) => JSON.parse(line) as TripResult)
  return { header: JSON.parse(first) as BaselineHeader, results: new Map(results.map((result) => [result.id, result])) }
}

export function writeBaseline(path: string, header: BaselineHeader, results: TripResult[]): void {
  const lines = [header, ...results].map((line) => JSON.stringify(line))
  writeFileSync(path, `${lines.join('\n')}\n`)
}
