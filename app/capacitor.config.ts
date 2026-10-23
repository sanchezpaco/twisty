import { readFileSync } from 'node:fs'
import type { CapacitorConfig } from '@capacitor/cli'

// The version is bumped in one place, the Android build.
const VERSION = /def twistyVersion = '([^']+)'/.exec(readFileSync('android/app/build.gradle', 'utf8'))?.[1]
if (!VERSION) throw new Error('No twistyVersion in android/app/build.gradle')

const config: CapacitorConfig = {
  appId: 'com.sanchezpaco.twisty',
  appName: 'Twisty',
  // The Vite build, including public/data, ships inside the APK: routing and town search work offline.
  webDir: 'dist',
  backgroundColor: '#07090d',
  // Nominatim's usage policy asks every request to name the app and a contact; a WebView fetch cannot set User-Agent itself.
  appendUserAgent: `Twisty/${VERSION} (com.sanchezpaco.twisty; +https://sanchezpaco.github.io/twisty/privacy)`,
  // The app is always dark: light status bar icons on the dark bars.
  plugins: { SystemBars: { style: 'DARK' } },
}

export default config
