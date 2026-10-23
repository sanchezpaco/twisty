/** An installed app that opens GPX files, as the system lists it. */
export interface GpxApp {
  packageName: string
  label: string
  /** A PNG data URL of the app's own icon. */
  icon: string
}

/** Where a ride goes. A saved `app` carries its name, so the button can say it before the apps are listed. */
export type OpenInTarget = { kind: 'maps' } | { kind: 'app'; packageName: string; label: string } | { kind: 'share' }

/** What an app does with the ride's GPX, as seen on a phone: it keeps the line, or recalculates a route from its own points. */
export type AppBehaviour = 'follows' | 'recalculates'

/**
 * The apps named in the chooser, each one only after its behaviour was checked on a phone with Twisty's own file.
 * Any other app that opens GPX is still reachable through "Other app (GPX)".
 */
const VERIFIED_APPS: Record<string, AppBehaviour> = {
  'net.osmand': 'follows',
  'com.kurviger.app': 'recalculates',
}

export const verifiedApps = (apps: GpxApp[]): GpxApp[] => apps.filter(({ packageName }) => packageName in VERIFIED_APPS)

export const behaviourOf = (packageName: string): AppBehaviour | undefined => VERIFIED_APPS[packageName]

export const MAPS_TARGET: OpenInTarget = { kind: 'maps' }
export const SHARE_TARGET: OpenInTarget = { kind: 'share' }

export const appTarget = ({ packageName, label }: GpxApp): OpenInTarget => ({ kind: 'app', packageName, label })

export interface RideNeeds {
  /** A ride Google Maps would not follow end to end (see `gpxIsPrimary`): the apps that follow a line come first. */
  gpxFirst: boolean
}

/** Apps that keep the line come before the ones that recalculate a route from it. */
const BEHAVIOUR_RANK: Record<AppBehaviour, number> = { follows: 0, recalculates: 1 }

/** The chooser's rows in order: Google Maps first, or last when it would skip part of the ride. */
export function chooserTargets(apps: GpxApp[], { gpxFirst }: RideNeeds): OpenInTarget[] {
  const rank = ({ packageName }: GpxApp) => BEHAVIOUR_RANK[behaviourOf(packageName) ?? 'recalculates']
  const gpx = [...apps].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label)).map(appTarget)
  return gpxFirst ? [...gpx, SHARE_TARGET, MAPS_TARGET] : [MAPS_TARGET, ...gpx, SHARE_TARGET]
}

export const sameTarget = (a: OpenInTarget | null, b: OpenInTarget | null): boolean =>
  a !== null && b !== null && a.kind === b.kind && (a.kind !== 'app' || a.packageName === (b as typeof a).packageName)

/** The words a target and the main button are named with; `i18n.t.openIn` has them. */
export interface OpenInTexts {
  button: string
  buttonWith: (app: string) => string
  googleMaps: string
  otherApp: string
  downloadGpx: string
}

/** An app is named by its own label, Google Maps by its brand, and the share sheet by what it does on this device. */
export function targetName(target: OpenInTarget, texts: OpenInTexts, sharesFiles: boolean): string {
  if (target.kind === 'app') return target.label
  if (target.kind === 'maps') return texts.googleMaps
  return sharesFiles ? texts.otherApp : texts.downloadGpx
}

/** What the main button says: "Open in…" while nothing is chosen, else where it goes. */
export function buttonLabel(target: OpenInTarget | null, texts: OpenInTexts, sharesFiles: boolean): string {
  if (target === null) return texts.button
  if (target.kind === 'share' && !sharesFiles) return texts.downloadGpx
  return texts.buttonWith(targetName(target, texts, sharesFiles))
}

/** A saved app that was uninstalled is no choice any more; Google Maps and the share sheet are always there. */
export function isUsable(target: OpenInTarget, apps: GpxApp[]): boolean {
  return target.kind !== 'app' || apps.some((app) => app.packageName === target.packageName)
}

export type OpenIn = { action: 'open'; target: OpenInTarget } | { action: 'choose' }

/**
 * What the main button does: open the saved app straight away, or ask. Google Maps saved as the choice still asks on a
 * ride it would skip a part of, which is what the line-following apps are for. Until the installed apps are listed
 * (`apps` is null) the saved choice is trusted, so the button does not flicker.
 */
export function resolveOpenIn(saved: OpenInTarget | null, apps: GpxApp[] | null, { gpxFirst }: RideNeeds): OpenIn {
  if (!saved || (apps !== null && !isUsable(saved, apps))) return { action: 'choose' }
  if (saved.kind === 'maps' && gpxFirst) return { action: 'choose' }
  return { action: 'open', target: saved }
}
