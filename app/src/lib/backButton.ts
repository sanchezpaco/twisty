import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

export type BackHandler = () => boolean

/** The newest handler gets the press first, and the first one that uses it ends the walk. */
export function runBackHandlers(handlers: BackHandler[]): boolean {
  return [...handlers].reverse().some((handler) => handler())
}

const handlers: BackHandler[] = []
let listening = false

/**
 * Android's back button: the handler says whether it used the press, and the app closes when none did. Handlers stack, so
 * a sheet opened over the panel is closed before the panel gets a say. A handler that is registered again (an effect
 * that re-runs) goes to the top, so read state inside the handler instead of re-registering on every change.
 */
export function onBackButton(handler: BackHandler): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}
  if (!listening) {
    listening = true
    void App.addListener('backButton', () => {
      if (!runBackHandlers(handlers)) void App.exitApp()
    })
  }
  handlers.push(handler)
  return () => {
    const at = handlers.indexOf(handler)
    if (at >= 0) handlers.splice(at, 1)
  }
}
