import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'

export interface SharedText {
  title: string
  text: string
  /** The title of the Android share sheet. */
  dialogTitle: string
}

/** `shared`: the system sheet took it. `copied`: no sheet here, so the text is on the clipboard. */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'copyFailed'

/** Closing the sheet without picking an app: the web says so with an AbortError, Capacitor on Android with a message. */
const cancelled = (error: unknown) => (error as Error).name === 'AbortError' || /cancel/i.test((error as Error).message ?? '')

/**
 * Hands text to the system share sheet, native or web. Where there is none (Firefox, some desktop browsers) the text is
 * copied instead, so it can still be pasted into a chat.
 */
export async function shareText({ title, text, dialogTitle }: SharedText): Promise<ShareResult> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title, text, dialogTitle })
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share({ title, text })
      return 'shared'
    }
  } catch (error) {
    if (cancelled(error)) return 'cancelled'
    console.error(error)
  }
  return copy(text)
}

async function copy(text: string): Promise<'copied' | 'copyFailed'> {
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch (error) {
    console.error(error)
    return 'copyFailed'
  }
}
