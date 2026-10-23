import type { RideOption } from './routing/ride'

/** A trip this short has no stretch worth a detour: the slider's stops stay out of sight until the rider asks. */
export const VERY_SHORT_TRIP_S = 15 * 60

/** Whether the panel keeps the stops of a planned trip hidden. The planner still computes them. */
export function stopsHidden(options: Pick<RideOption, 'timeS'>[], refining: boolean, revealed: boolean): boolean {
  return !refining && !revealed && options.length > 1 && options[0].timeS < VERY_SHORT_TRIP_S
}
