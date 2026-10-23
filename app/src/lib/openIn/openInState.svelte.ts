import { type GpxApp, type OpenInTarget, verifiedApps } from './openIn'
import { listGpxApps } from './nativeApps'
import { loadTarget, saveTarget } from './preference'

/** The apps named in the chooser that are installed right now; null until the first listing is back. */
export const installed = $state<{ apps: GpxApp[] | null }>({ apps: null })

/** What the rider chose with "always use this app", if anything. */
export const choice = $state<{ target: OpenInTarget | null }>({ target: loadTarget() })

export async function refreshInstalledApps(): Promise<void> {
  try {
    installed.apps = verifiedApps(await listGpxApps())
  } catch (error) {
    console.error(error)
    installed.apps = []
  }
}

export function rememberTarget(target: OpenInTarget | null): void {
  choice.target = target
  saveTarget(target)
}
