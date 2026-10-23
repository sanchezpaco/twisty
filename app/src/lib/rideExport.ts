import { type GpxStop, gpxTrack } from './gpx'
import { openGpxIn } from './openIn/nativeApps'
import type { RideOption } from './routing/ride'
import { cacheGpx, shareGpx } from './shareFile'

/** The ride's line, and a waypoint for each of the rider's stops so a GPS app shows where the day pauses. */
const rideGpx = (ride: RideOption, gpxName: string, stops: GpxStop[]): string =>
  gpxTrack(gpxName.replace(/\.gpx$/, ''), ride.segments.flatMap((segment) => segment.line), stops)

/** The ride's GPX through the system share sheet (or a download on the web), for whatever app the rider picks there. */
export async function shareRideGpx(ride: RideOption, gpxName: string, stops: GpxStop[] = []): Promise<void> {
  try {
    await shareGpx(gpxName, rideGpx(ride, gpxName, stops))
  } catch (error) {
    // Closing the share sheet without picking an app is not a failure.
    if ((error as Error).name !== 'AbortError') throw error
  }
}

/** The app was asked to open the ride and refused, or is not there any more: the rider's choice of it is worth forgetting. */
export class AppRejected extends Error {}

/** The ride's GPX straight into one installed app; throws `AppRejected` when that app cannot open it. */
export async function openRideInApp(ride: RideOption, gpxName: string, packageName: string, stops: GpxStop[] = []): Promise<void> {
  const uri = await cacheGpx(gpxName, rideGpx(ride, gpxName, stops))
  try {
    await openGpxIn(uri, packageName)
  } catch (error) {
    throw new AppRejected((error as Error).message)
  }
}
