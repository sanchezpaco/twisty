import { Capacitor } from '@capacitor/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listGpxApps } from './nativeApps'

describe('listGpxApps', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lists nothing on the web, where installed apps cannot be asked', async () => {
    expect(await listGpxApps()).toEqual([])
  })

  // The OpenIn plugin exists only in the Android app: on iOS asking it would reject, and the share sheet lists the apps.
  it('lists nothing on iOS', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios')
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    expect(await listGpxApps()).toEqual([])
  })
})
