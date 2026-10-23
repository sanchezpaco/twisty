import { isMainThread } from 'node:worker_threads'
import { main } from './main'
import { runWorker } from './worker'

// One entry for the script and its workers: a bundled `--ssr` build has a single output file to start workers from.
if (isMainThread) main(process.argv.slice(2)).then((code) => process.exit(code), (error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(2)
})
else runWorker()
