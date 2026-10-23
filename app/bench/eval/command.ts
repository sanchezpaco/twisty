import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { readBaseline } from '../baseline'
import { readRoads } from '../roads'
import { readTrips } from '../trips'
import { evaluate, evaluateTrips } from './evaluate'
import { addedMisses, freeze, NOTHING_ADDED, readFrozen, readTripsFile } from './frozen'

const EVAL_DIR = 'bench/eval'
const FROZEN_PATH = join(EVAL_DIR, 'frozen.json')
const PROMPT_PATH = join(EVAL_DIR, 'judge-prompt.md')

const flag = (flags: string[], name: string): string | undefined => (flags.includes(name) ? flags[flags.indexOf(name) + 1] : undefined)

/** `eval-freeze --baseline <baseline.jsonl>`: writes the lists the kit judges from now on. Run it once per kit version. */
export function evalFreeze(flags: string[]): number {
  const path = flag(flags, '--baseline')
  if (!path) throw new Error('Usage: run.js eval-freeze --baseline <baseline.jsonl>')
  const baseline = readBaseline(resolve(path))
  if (!baseline) throw new Error(`No baseline at ${path}`)
  const frozen = freeze({ baseline: { header: baseline.header, results: [...baseline.results.values()] }, trips: readTrips(resolve('bench/trips.json')), roads: readRoads(resolve('bench/great-roads.json')).roads })
  mkdirSync(dirname(FROZEN_PATH), { recursive: true })
  writeFileSync(FROZEN_PATH, `${JSON.stringify(frozen, null, 1)}\n`)
  console.log(`froze ${frozen.misses.length} misses, ${frozen.controls.length} controls, ${frozen.sample.length} sample trips from ${baseline.header.commit}: ${FROZEN_PATH}`)
  return 0
}

/**
 * `eval --out <dir> [--added <results.jsonl>]`: the dossier of the frozen lists on `TWISTY_DATA`, plus the new misses of a run.
 * `eval --out <dir> --trips <trips.json> --data <dir>[,<dir>...]`: absolute cards only, for the trips of the file, every
 * data folder's routes mixed blind (the out-of-sample check of a value change).
 */
export function evalDossier(flags: string[], commit: string): number {
  const out = flag(flags, '--out')
  if (!out) throw new Error('Usage: run.js eval --out <dir> [--added <results.jsonl of a bench run>] | [--trips <trips.json> --data <dir>,<dir>]')
  const tripsPath = flag(flags, '--trips')
  if (tripsPath) {
    const data = flag(flags, '--data')
    if (!data) throw new Error('--trips needs --data <dir>[,<dir>...]: the versions to judge')
    const file = readTripsFile(resolve(tripsPath))
    return evaluateTrips({ dataDirs: data.split(',').map((dir) => resolve(dir)), trips: file.trips, seed: file.seed, outDir: resolve(out), commit, promptPath: resolve(PROMPT_PATH) })
  }
  const frozen = readFrozen(FROZEN_PATH)
  const resultsPath = flag(flags, '--added')
  const results = resultsPath
    ? readFileSync(resolve(resultsPath), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    : null
  const added = results ? addedMisses(frozen, results, readTrips(resolve('bench/trips.json')), readRoads(resolve('bench/great-roads.json')).roads) : NOTHING_ADDED
  return evaluate({ dataDir: resolve(process.env.TWISTY_DATA ?? 'public/data'), frozen, added, outDir: resolve(out), commit, promptPath: resolve(PROMPT_PATH) })
}
