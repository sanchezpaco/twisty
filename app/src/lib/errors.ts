/** Problems the rider can be told about; each one has a message in every language (see `i18n`). */
export type PlanningErrorCode = 'tooFar' | 'noConnection' | 'sameSpot' | 'tracksDownload' | 'unexpected'
export type AppError = PlanningErrorCode

/**
 * Where a trip fails: the leg with no road between its points (`noConnection`) or whose points snap to one spot of the graph
 * (`sameSpot`), or the point far from any road (`tooFar`).
 */
export interface FailedAt {
  leg?: number
  point?: number
}

export class PlanningError extends Error {
  constructor(
    readonly code: PlanningErrorCode,
    readonly at: FailedAt = {},
  ) {
    super(code)
  }
}
