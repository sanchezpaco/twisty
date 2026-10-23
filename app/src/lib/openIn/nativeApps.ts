import { Capacitor, registerPlugin } from '@capacitor/core'
import type { GpxApp } from './openIn'

interface OpenInPlugin {
  listGpxApps(): Promise<{ apps: GpxApp[] }>
  openGpx(options: { uri: string; packageName: string }): Promise<void>
}

const OpenIn = registerPlugin<OpenInPlugin>('OpenIn')

/**
 * The installed apps that open GPX files, which only Android can be asked for: on the web and on iOS nothing is listed,
 * and the GPX goes to the system share sheet, where iOS offers the apps that take it.
 */
export async function listGpxApps(): Promise<GpxApp[]> {
  if (Capacitor.getPlatform() !== 'android') return []
  return (await OpenIn.listGpxApps()).apps
}

/** Hands a GPX file in the app's cache (the `uri` that writing it returned) to one app. Rejects when it cannot open it. */
export function openGpxIn(uri: string, packageName: string): Promise<void> {
  return OpenIn.openGpx({ uri, packageName })
}
