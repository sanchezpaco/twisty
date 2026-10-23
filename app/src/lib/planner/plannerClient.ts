import { PlanningError, type PlanningErrorCode } from '../errors'
import type { LonLat } from '../geo'
import type { RideOption } from '../routing/ride'
import type { PlannerRequest, PlannerResponse } from './messages'

export interface PlannerEvents {
  /** Download progress from 0 to 1, or null when the size is unknown (e.g. files bundled in the APK). */
  onProgress: (fraction: number | null) => void
  onReady: () => void
  onError: (code: PlanningErrorCode) => void
}

interface Pending {
  resolve: (options: RideOption[]) => void
  reject: (error: Error) => void
  onFastest?: (option: RideOption) => void
}

/** Runs the planner in a Web Worker so the map stays smooth while the graph loads and searches run. */
export class PlannerClient {
  private readonly worker = new Worker(new URL('./planner.worker.ts', import.meta.url), { type: 'module' })
  private readonly pending = new Map<number, Pending>()
  private nextId = 1

  constructor(events: PlannerEvents) {
    this.worker.onmessage = ({ data }: MessageEvent<PlannerResponse>) => {
      if (data.type === 'progress') events.onProgress(data.totalBytes ? data.loadedBytes / data.totalBytes : null)
      else if (data.type === 'ready') events.onReady()
      else if (data.type === 'fastest') this.pending.get(data.id)?.onFastest?.(data.option)
      else if (data.type === 'planned') this.settle(data.id, (p) => p.resolve(data.options))
      else if (data.id !== undefined) this.settle(data.id, (p) => p.reject(new PlanningError(data.code, { leg: data.leg, point: data.point })))
      else events.onError(data.code)
    }
    this.send({ type: 'load' })
  }

  /**
   * `points` are the start, the rider's stops in order and the finish; `startIsRider` when the start is "My location".
   * `onFastest` hears the fastest ride as soon as it is known; the promise settles with all the options.
   */
  plan(points: LonLat[], { includeTracks, startIsRider }: { includeTracks: boolean; startIsRider: boolean }, onFastest?: (option: RideOption) => void): Promise<RideOption[]> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onFastest })
      this.send({ type: 'plan', id, points, includeTracks, startIsRider })
    })
  }

  private settle(id: number, action: (pending: Pending) => void) {
    const pending = this.pending.get(id)
    this.pending.delete(id)
    if (pending) action(pending)
  }

  private send(request: PlannerRequest): void {
    this.worker.postMessage(request)
  }
}
