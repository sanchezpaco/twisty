// Finds the twisty roads of the routing graph and the legs between them once, so that no phone has to (`make candidates`).
// With --check it only reads the file there, and fails unless it is of this graph: a release must not ship without it.
//   node scripts/.build/candidates.js [--data public/data] [--check]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseGraph } from '../src/lib/data/graph'
import { findCandidates, parseCandidates, serialiseCandidates } from '../src/lib/routing/candidates'
import { buildLegTable } from '../src/lib/routing/legs'

const at = process.argv.indexOf('--data')
const data = resolve(at > 0 ? process.argv[at + 1] : 'public/data')
const read = (name: string) => {
  const bytes = readFileSync(join(data, name))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}
const graph = parseGraph(read('graph.bin'))
if (process.argv.includes('--check')) {
  if (!existsSync(join(data, 'candidates.bin'))) throw new Error(`No candidates.bin in ${data}: run 'make candidates'`)
  const { candidates } = parseCandidates(graph, read('candidates.bin'))
  console.log(`candidates.bin: ${candidates.length.toLocaleString()} roads of this graph`)
  process.exit(0)
}
const found = findCandidates(graph)
const legs = buildLegTable(graph, found)
const file = serialiseCandidates(graph, found, legs)
writeFileSync(join(data, 'candidates.bin'), new Uint8Array(file))
console.log(`candidates: ${found.length.toLocaleString()} roads, ${legs.target.length.toLocaleString()} legs, ${(file.byteLength / 1e6).toFixed(2)} MB in ${data}`)
