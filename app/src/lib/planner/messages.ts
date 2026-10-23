import type { FailedAt, PlanningErrorCode } from '../errors'
import type { LonLat } from '../geo'
import type { RideOption } from '../routing/ride'

export type PlannerRequest =
  | { type: 'load' }
  /** `points`: the start, the rider's stops in order, the finish (see Planner.plan). */
  | { type: 'plan'; id: number; points: LonLat[]; includeTracks: boolean; startIsRider: boolean }

export type PlannerResponse =
  | { type: 'progress'; loadedBytes: number; totalBytes: number }
  | { type: 'ready' }
  /** The fastest ride, ahead of the rest of the options. */
  | { type: 'fastest'; id: number; option: RideOption }
  | { type: 'planned'; id: number; options: RideOption[] }
  | ({ type: 'failed'; id?: number; code: PlanningErrorCode } & FailedAt)
