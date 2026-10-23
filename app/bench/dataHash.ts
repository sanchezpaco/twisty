import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The data, not its build time: `generatedAt` changes on every rebuild even when nothing else does. */
export function dataHash(dataDir: string): string {
  const hash = createHash('sha256')
  for (const file of ['graph.bin', 'tracks.bin']) if (existsSync(join(dataDir, file))) hash.update(readFileSync(join(dataDir, file)))
  return hash.digest('hex').slice(0, 16)
}
