import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseGraph } from '../data/graph'
import type { LonLat } from '../geo'
import { Planner } from './planner'

// Smoke test against the real pipeline output; skipped when the data has not been built.
const DATA_DIR = new URL('../../../public/data/', import.meta.url)
const hasData = existsSync(new URL('graph.bin', DATA_DIR))

const TRIPS: [name: string, from: LonLat, to: LonLat][] = [
  ['Madrid → Granada', [-3.7038, 40.4168], [-3.5986, 37.1773]],
  ['València → Los Santos (Ademuz)', [-0.3763, 39.4699], [-1.28005, 40.10779]],
  ['Huesca → Jaca', [-0.4087, 42.1401], [-0.5498, 42.5705]],
]

describe.skipIf(!hasData)('Planner on Spain data', () => {
  const load = () => {
    const bytes = readFileSync(new URL('graph.bin', DATA_DIR))
    return new Planner(parseGraph(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)))
  }

  it.each(TRIPS)('%s: fastest first, then progressively curvier', (name, from, to) => {
    const planner = load()
    const started = performance.now()
    const options = planner.plan([from, to])
    console.log(`\n${name}: planned in ${(performance.now() - started).toFixed(0)} ms`)
    for (const o of options) {
      console.log(
        `  ${(o.timeS / 3600).toFixed(2)} h (+${Math.round(o.extraS / 60)} min) ` +
          `curvy ${(o.curvyM / 1000).toFixed(0)} km, motorway ${(o.motorwayM / 1000).toFixed(0)} km, ` +
          `total ${(o.distanceM / 1000).toFixed(0)} km: ${o.twisties.map((t) => t.label).join(' | ')}`,
      )
    }
    expect(options[0].extraS).toBe(0)
    expect(options.length).toBeGreaterThan(2)
    for (let i = 1; i < options.length; i++) {
      expect(options[i].timeS).toBeGreaterThan(options[i - 1].timeS)
      expect(options[i].curvyM).toBeGreaterThan(options[i - 1].curvyM)
      expect(options[i].twistyM).toBeGreaterThan(options[i - 1].twistyM)
    }
  }, 60_000)
})
