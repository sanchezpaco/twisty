import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const GPX_TYPE = 'application/gpx+xml'

/**
 * Hands a GPX file to whatever app the rider picks (Wikiloc, OsmAnd, Garmin…) through the system share sheet,
 * or downloads it where sharing files is not available.
 */
export async function shareGpx(fileName: string, gpx: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Share.share({ title: fileName, files: [await cacheGpx(fileName, gpx)] })
    return
  }
  const file = new File([gpx], fileName, { type: GPX_TYPE })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: fileName })
    return
  }
  download(file)
}

/** Writes the GPX where the app's file provider can hand it to another app, and says where. */
export async function cacheGpx(fileName: string, gpx: string): Promise<string> {
  const { uri } = await Filesystem.writeFile({ path: fileName, data: gpx, directory: Directory.Cache, encoding: Encoding.UTF8 })
  return uri
}

/** Whether the GPX can leave through the system share sheet, which is what "Other app" opens. */
export const canShareGpx = (): boolean =>
  Capacitor.isNativePlatform() || (navigator.canShare?.({ files: [new File([''], 'ride.gpx', { type: GPX_TYPE })] }) ?? false)

function download(file: File): void {
  const url = URL.createObjectURL(file)
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name })
  link.click()
  URL.revokeObjectURL(url)
}
