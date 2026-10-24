import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  isNative: false,
  platform: 'web',
  permissions: { location: 'prompt', coarseLocation: 'prompt' } as Record<string, string>,
  answer: { location: 'granted', coarseLocation: 'granted' } as Record<string, string>,
  locationOff: false,
  fix: (async () => ({ coords: { longitude: 0, latitude: 0 } })) as (options: unknown) => Promise<{ coords: { longitude: number; latitude: number; accuracy?: number } }>,
}))
// With location off the plugin cannot report a permission at all: it rejects.
const permissionsOr = vi.hoisted(() => (permissions: Record<string, string>) => {
  if (native.locationOff) throw new Error('Location services are not enabled')
  return permissions
})
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.isNative, getPlatform: () => native.platform } }))
vi.mock('@capacitor/geolocation', () => ({ Geolocation: { checkPermissions: async () => permissionsOr(native.permissions), requestPermissions: async () => permissionsOr(native.answer), getCurrentPosition: (options: unknown) => native.fix(options) } }))

import { knownPosition, LOCATE_MAX_AGE_MS, LOCATE_TIMEOUT_MS, LocationError, locateRider, locationAllowed, locationProblem, locationProblemOf, nativePosition, permissionAsk, placeHere, riderPosition } from './locate'

type Geo = Parameters<typeof locateRider>[0]

const answering = (coords: { longitude: number; latitude: number; accuracy?: number }): Geo => ({
  getCurrentPosition: (ok) => ok({ coords } as GeolocationPosition),
})

const failing = (message: string, code?: number): Geo => ({
  getCurrentPosition: (_ok, fail) => fail?.({ message, code } as GeolocationPositionError),
})

describe('locateRider', () => {
  it('resolves the rider with how far off the fix may be', async () => {
    expect(await locateRider(answering({ longitude: -0.37, latitude: 39.47, accuracy: 35 }))).toEqual({ position: [-0.37, 39.47], accuracyM: 35 })
  })

  it('makes a place that stays out of the history from the fix', () => {
    expect(placeHere({ position: [-0.37, 39.47], accuracyM: 35 }, 'My location')).toEqual({ label: 'My location', position: [-0.37, 39.47], here: true })
  })

  it('asks for a fix that gives up after ten seconds, without high accuracy, and takes one up to two minutes old', async () => {
    let options: PositionOptions | undefined
    const geo: Geo = {
      getCurrentPosition: (ok, _fail, given) => {
        options = given
        ok({ coords: { longitude: 0, latitude: 0 } } as GeolocationPosition)
      },
    }
    await locateRider(geo)
    expect(options).toEqual({ enableHighAccuracy: false, timeout: LOCATE_TIMEOUT_MS, maximumAge: LOCATE_MAX_AGE_MS })
    expect(LOCATE_TIMEOUT_MS).toBe(10_000)
    expect(LOCATE_MAX_AGE_MS).toBe(120_000)
  })

  it('rejects when the fix times out or is refused', async () => {
    await expect(locateRider(failing('Timeout expired'))).rejects.toBeInstanceOf(LocationError)
  })

  it('rejects when the device has no geolocation', async () => {
    await expect(locateRider(undefined)).rejects.toBeInstanceOf(LocationError)
  })

  it('starts the timed fix only once the rider has answered the permission prompt', async () => {
    const steps: string[] = []
    const geo: Geo = {
      getCurrentPosition: (ok) => {
        steps.push('fix')
        ok({ coords: { longitude: 0, latitude: 0 } } as GeolocationPosition)
      },
    }
    await locateRider(geo, async () => {
      steps.push('ask')
      return true
    })
    expect(steps).toEqual(['ask', 'fix'])
  })

  it('refuses without a fix when the rider refused the permission, so the refusal is what they are told', async () => {
    const fix = vi.fn()
    const error = await locateRider({ getCurrentPosition: fix }, async () => false).catch((e) => e)
    expect(fix).not.toHaveBeenCalled()
    expect(error).toBeInstanceOf(LocationError)
    expect(await locationProblem(error)).toBe('denied')
  })
})

describe('permissionAsk', () => {
  beforeEach(() => {
    native.isNative = true
    native.answer = { location: 'granted', coarseLocation: 'granted' }
  })

  it('leaves the asking to the fix in a browser', () => {
    native.isNative = false
    expect(permissionAsk()).toBeUndefined()
  })

  it('takes an approximate location as allowed', async () => {
    native.answer = { location: 'denied', coarseLocation: 'granted' }
    expect(await permissionAsk()?.()).toBe(true)
  })

  it('says no when the rider refused both', async () => {
    native.answer = { location: 'denied', coarseLocation: 'denied' }
    expect(await permissionAsk()?.()).toBe(false)
  })
})

describe('knownPosition', () => {
  const allowed = async () => true
  const notAllowed = async () => false

  it('reads the position only when location is already allowed, never asking for it', async () => {
    const asked: string[] = []
    const geo: Geo = { getCurrentPosition: (ok) => (asked.push('fix'), ok({ coords: { longitude: -0.38, latitude: 39.47 } } as GeolocationPosition)) }
    expect(await knownPosition(geo, allowed)).toEqual([-0.38, 39.47])
    expect(await knownPosition(geo, notAllowed)).toBeNull()
    expect(await knownPosition(undefined, allowed)).toBeNull()
    expect(asked).toEqual(['fix'])
  })

  it('goes without when no fix comes', async () => {
    expect(await knownPosition(failing('timeout'), allowed)).toBeNull()
  })
})

describe('locationAllowed', () => {
  const answering = (state: PermissionState) => ({ query: async () => ({ state }) as PermissionStatus })

  beforeEach(() => {
    native.isNative = false
    native.permissions = { location: 'prompt', coarseLocation: 'prompt' }
  })

  it('on the web, is what the browser says', async () => {
    expect(await locationAllowed(answering('granted'))).toBe(true)
    expect(await locationAllowed(answering('prompt'))).toBe(false)
    expect(await locationAllowed(answering('denied'))).toBe(false)
    expect(await locationAllowed(undefined)).toBe(false)
    expect(await locationAllowed({ query: async () => Promise.reject(new TypeError('geolocation')) })).toBe(false)
  })

  it("in the app, is Android's permission, approximate included, whatever the WebView says", async () => {
    native.isNative = true
    expect(await locationAllowed(answering('prompt'))).toBe(false)
    native.permissions = { location: 'granted', coarseLocation: 'granted' }
    expect(await locationAllowed(answering('prompt'))).toBe(true)
    native.permissions = { location: 'denied', coarseLocation: 'granted' }
    expect(await locationAllowed(undefined)).toBe(true)
  })
})

describe('riderPosition', () => {
  beforeEach(() => (native.platform = 'web'))

  // WKWebView's web API asks again on every page load ("localhost wants to use your location"); the plugin asks once.
  it('reads the position through the native plugin on iOS', () => {
    native.platform = 'ios'
    expect(riderPosition()).toBe(nativePosition)
  })

  it('keeps the web API on Android and the web', () => {
    for (const platform of ['android', 'web']) {
      native.platform = platform
      expect(riderPosition()).toBe(navigator.geolocation)
    }
  })
})

describe('nativePosition', () => {
  it('places the rider from the plugin, with the options the web API was given', async () => {
    let given: unknown
    native.fix = async (options) => {
      given = options
      return { coords: { longitude: -0.37, latitude: 39.47, accuracy: 20 } }
    }
    expect(await locateRider(nativePosition)).toEqual({ position: [-0.37, 39.47], accuracyM: 20 })
    expect(given).toEqual({ enableHighAccuracy: false, timeout: LOCATE_TIMEOUT_MS, maximumAge: LOCATE_MAX_AGE_MS })
  })

  it('turns a refusal of the plugin into a location error', async () => {
    native.fix = async () => {
      throw new Error('Location permission was denied')
    }
    await expect(locateRider(nativePosition)).rejects.toThrow(new LocationError('Location permission was denied'))
  })

  it('leaves an address search without a fix when the plugin fails', async () => {
    native.fix = async () => {
      throw new Error('timeout')
    }
    expect(await knownPosition(nativePosition, async () => true)).toBeNull()
  })
})

describe('locationProblemOf', () => {
  it('reads a refusal from the web API', () => {
    expect(locationProblemOf(1, null)).toBe('denied')
  })

  it('reads a timeout or a phone without a fix as unavailable', () => {
    expect(locationProblemOf(3, null)).toBe('unavailable')
    expect(locationProblemOf(2, null)).toBe('unavailable')
    expect(locationProblemOf(undefined, null)).toBe('unavailable')
  })

  it('reads a refusal from the native permission state when the plugin gives no code', () => {
    expect(locationProblemOf(undefined, { location: 'denied', coarseLocation: 'denied' })).toBe('denied')
  })

  it('keeps an approximate permission as allowed: the fix failed for another reason', () => {
    expect(locationProblemOf(undefined, { location: 'denied', coarseLocation: 'granted' })).toBe('unavailable')
  })
})

describe('locationProblem', () => {
  beforeEach(() => {
    native.isNative = false
    native.locationOff = false
    native.permissions = { location: 'prompt', coarseLocation: 'prompt' }
  })

  it('carries the web API code of a failed fix', async () => {
    const error = await locateRider(failing('User denied Geolocation', 1)).catch((e) => e)
    expect(await locationProblem(error)).toBe('denied')
  })

  it('asks the plugin on the device when the failure has no refusal code', async () => {
    native.isNative = true
    native.permissions = { location: 'denied', coarseLocation: 'denied' }
    expect(await locationProblem(new LocationError('Location permission was denied'))).toBe('denied')
    native.permissions = { location: 'granted', coarseLocation: 'granted' }
    expect(await locationProblem(new LocationError('Timeout expired', 3))).toBe('unavailable')
  })

  it('says location is off when the device cannot even ask for it, without waiting for a fix', async () => {
    native.isNative = true
    native.locationOff = true
    const fix = vi.fn()
    const error = await locateRider({ getCurrentPosition: fix }, permissionAsk()).catch((e) => e)
    expect(fix).not.toHaveBeenCalled()
    expect(await locationProblem(error)).toBe('unavailable')
  })

  it('does not ask the plugin in a browser', async () => {
    native.permissions = { location: 'denied', coarseLocation: 'denied' }
    expect(await locationProblem(new LocationError('Timeout expired', 3))).toBe('unavailable')
  })
})
