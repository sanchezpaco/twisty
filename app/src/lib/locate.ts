import { Capacitor } from '@capacitor/core'
import { Geolocation as NativeGeolocation } from '@capacitor/geolocation'
import type { LonLat } from './geo'
import type { Place } from './geocoding'

/** A fix that takes longer than this is reported as a failure: the rider is waiting on an empty start field. */
export const LOCATE_TIMEOUT_MS = 10_000
/** A fix this recent is the rider's position still: taking it answers at once, where a fresh one can take seconds. */
export const LOCATE_MAX_AGE_MS = 2 * 60_000

// An address search takes a fix this old, and waits this long for one, rather than biasing towards somewhere else.
export const KNOWN_FIX_MAX_AGE_MS = 10 * 60_000
export const KNOWN_FIX_TIMEOUT_MS = 3_000

/** `code` is the web API's: 1 when the permission was refused, 2 when there is no position, 3 when it took too long. */
export class LocationError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message)
  }
}

/** Why there is no position, as far as the rider can act on it: allow the app in Settings, or turn location on. */
export type LocationProblem = 'denied' | 'unavailable'

const PERMISSION_DENIED = 1

type NativePermissions = { location: string; coarseLocation: string }
const anyGranted = ({ location, coarseLocation }: NativePermissions) => location === 'granted' || coarseLocation === 'granted'

/** The web API says when the permission was refused; the native plugin does not, so its permission state is asked after. */
export function locationProblemOf(code: number | undefined, nativePermissions: NativePermissions | null): LocationProblem {
  if (code === PERMISSION_DENIED) return 'denied'
  if (nativePermissions?.location === 'denied' && nativePermissions.coarseLocation === 'denied') return 'denied'
  return 'unavailable'
}

/** Why a fix failed; on the device the plugin's permission state tells a refusal from a phone without a fix. */
export async function locationProblem(error: unknown): Promise<LocationProblem> {
  const code = error instanceof LocationError ? error.code : undefined
  if (code === PERMISSION_DENIED || !Capacitor.isNativePlatform()) return locationProblemOf(code, null)
  try {
    return locationProblemOf(code, await NativeGeolocation.checkPermissions())
  } catch {
    return 'unavailable'
  }
}

type PositionSource = Pick<Geolocation, 'getCurrentPosition'>

/**
 * Where the app reads the rider's position. On iOS the web API asks twice, the app's permission and then WebKit's own
 * "localhost" prompt on every page load, which no public iOS API can answer: there the native plugin reads it, behind
 * iOS's one prompt. Android's WebView answers the web API with the app's permission, so it keeps that path.
 */
export function riderPosition(): PositionSource | undefined {
  if (Capacitor.getPlatform() === 'ios') return nativePosition
  return typeof navigator === 'undefined' ? undefined : navigator.geolocation
}

/** The native plugin in the web API's shape; only the coordinates and the failure's message are ever read. */
export const nativePosition: PositionSource = {
  getCurrentPosition(success, failure, options) {
    NativeGeolocation.getCurrentPosition({ enableHighAccuracy: options?.enableHighAccuracy, timeout: options?.timeout, maximumAge: options?.maximumAge }).then(
      (position) => success(position as unknown as GeolocationPosition),
      (error: Error) => failure?.({ message: error.message } as GeolocationPositionError),
    )
  },
}

/** Where the rider is, and how far off that may be, as the device reports it. */
export interface RiderFix {
  position: LonLat
  accuracyM: number
}

/** Asks the rider for their location, if not yet answered; true when they allowed it, approximate included. */
export type PermissionAsk = () => Promise<boolean>

/**
 * In the app the permission is asked before the fix: the fix's timeout would otherwise run while the rider reads the
 * system prompt, and fail behind it. In a browser the fix asks itself, and its timeout waits for the answer.
 */
export function permissionAsk(): PermissionAsk | undefined {
  if (!Capacitor.isNativePlatform()) return undefined
  return async () => anyGranted(await NativeGeolocation.requestPermissions())
}

/** The rider's position, or a `LocationError` when there is no geolocation, no permission or no fix in time. */
export async function locateRider(geolocation: Pick<Geolocation, 'getCurrentPosition'> | undefined, ask?: PermissionAsk): Promise<RiderFix> {
  if (!geolocation) throw new LocationError('geolocation is not available')
  if (ask && !(await ask())) throw new LocationError('location permission was refused', PERMISSION_DENIED)
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => resolve({ position: [coords.longitude, coords.latitude], accuracyM: coords.accuracy }),
      (failure) => reject(new LocationError(failure.message, failure.code)),
      { enableHighAccuracy: false, timeout: LOCATE_TIMEOUT_MS, maximumAge: LOCATE_MAX_AGE_MS },
    )
  })
}

/** The rider's position as a place: the start or finish that says "here". */
export function placeHere(fix: RiderFix, label: string): Place {
  return { label, position: fix.position, here: true }
}

/**
 * Whether the app may read the rider's position without asking. In the app it is Android's own permission, approximate
 * included: the WebView's Permissions API says "prompt" there whatever the rider allowed, as Capacitor grants each request
 * without the WebView remembering it.
 */
export async function locationAllowed(permissions: Pick<Permissions, 'query'> | undefined): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      return anyGranted(await NativeGeolocation.checkPermissions())
    }
    return (await permissions?.query({ name: 'geolocation' }))?.state === 'granted'
  } catch {
    return false
  }
}

/**
 * The rider's position when the app may already read it, or null: no permission is asked for, so a rider who never
 * allowed it is not interrupted by a search.
 */
export async function knownPosition(
  geolocation: Pick<Geolocation, 'getCurrentPosition'> | undefined,
  allowed: () => Promise<boolean>,
): Promise<LonLat | null> {
  if (!geolocation || !(await allowed())) return null
  return new Promise((resolve) =>
    geolocation.getCurrentPosition(
      ({ coords }) => resolve([coords.longitude, coords.latitude]),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: KNOWN_FIX_MAX_AGE_MS, timeout: KNOWN_FIX_TIMEOUT_MS },
    ),
  )
}
