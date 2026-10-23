import type { RideOption } from './routing/ride'

/** From this much track the ride goes to an app that follows a GPX line: Google Maps would skip a good part of it. */
export const GPX_PRIMARY_MIN_TRACK_M = 2_000

export const gpxIsPrimary = (ride: Pick<RideOption, 'trackM'>): boolean => ride.trackM >= GPX_PRIMARY_MIN_TRACK_M
