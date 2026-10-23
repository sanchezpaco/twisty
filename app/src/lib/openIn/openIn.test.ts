import { describe, expect, it } from 'vitest'
import { appTarget, behaviourOf, buttonLabel, chooserTargets, type GpxApp, isUsable, MAPS_TARGET, type OpenInTexts, resolveOpenIn, sameTarget, SHARE_TARGET, targetName, verifiedApps } from './openIn'
import { parseTarget, serializeTarget } from './preference'

const osmand: GpxApp = { packageName: 'net.osmand', label: 'OsmAnd', icon: 'data:image/png;base64,AA==' }
const kurviger: GpxApp = { packageName: 'com.kurviger.app', label: 'Kurviger', icon: 'data:image/png;base64,AA==' }

describe('verifiedApps', () => {
  const termux: GpxApp = { packageName: 'com.termux', label: 'Termux', icon: 'data:image/png;base64,AA==' }

  it('names only the apps whose behaviour was checked', () => {
    expect(verifiedApps([termux, osmand, kurviger])).toEqual([osmand, kurviger])
  })

  it('knows what each one does with the file', () => {
    expect(behaviourOf('net.osmand')).toBe('follows')
    expect(behaviourOf('com.kurviger.app')).toBe('recalculates')
    expect(behaviourOf('com.termux')).toBeUndefined()
  })
})

describe('chooserTargets', () => {
  it('leads with Google Maps, then the apps, then the share sheet', () => {
    expect(chooserTargets([osmand, kurviger], { gpxFirst: false })).toEqual([MAPS_TARGET, appTarget(osmand), appTarget(kurviger), SHARE_TARGET])
  })

  it('puts Google Maps last on a ride it would skip a part of', () => {
    expect(chooserTargets([osmand], { gpxFirst: true })).toEqual([appTarget(osmand), SHARE_TARGET, MAPS_TARGET])
  })

  it('puts the apps that keep the line before the ones that recalculate, then by name', () => {
    const wikiloc: GpxApp = { packageName: 'net.osmand', label: 'AAA OsmAnd', icon: 'x' }
    expect(chooserTargets([kurviger, wikiloc], { gpxFirst: true })).toEqual([appTarget(wikiloc), appTarget(kurviger), SHARE_TARGET, MAPS_TARGET])
  })

  it('still offers Google Maps and the share sheet when no app is installed', () => {
    expect(chooserTargets([], { gpxFirst: false })).toEqual([MAPS_TARGET, SHARE_TARGET])
  })
})

describe('resolveOpenIn', () => {
  const plain = { gpxFirst: false }
  const tracks = { gpxFirst: true }

  it('asks when nothing was chosen', () => {
    expect(resolveOpenIn(null, [osmand], plain)).toEqual({ action: 'choose' })
  })

  it('opens the saved app straight away', () => {
    expect(resolveOpenIn(appTarget(osmand), [osmand], tracks)).toEqual({ action: 'open', target: appTarget(osmand) })
    expect(resolveOpenIn(MAPS_TARGET, [], plain)).toEqual({ action: 'open', target: MAPS_TARGET })
    expect(resolveOpenIn(SHARE_TARGET, [], tracks)).toEqual({ action: 'open', target: SHARE_TARGET })
  })

  it('trusts the saved app until the installed apps are listed', () => {
    expect(resolveOpenIn(appTarget(kurviger), null, plain)).toEqual({ action: 'open', target: appTarget(kurviger) })
  })

  it('asks again when the saved app is gone', () => {
    expect(resolveOpenIn(appTarget(kurviger), [osmand], plain)).toEqual({ action: 'choose' })
  })

  it('does not open Google Maps on a ride it would skip a part of', () => {
    expect(resolveOpenIn(MAPS_TARGET, [osmand], tracks)).toEqual({ action: 'choose' })
  })
})

describe('isUsable', () => {
  it('needs an app to be installed, and nothing else', () => {
    expect(isUsable(appTarget(osmand), [osmand])).toBe(true)
    expect(isUsable(appTarget(osmand), [])).toBe(false)
    expect(isUsable(MAPS_TARGET, [])).toBe(true)
    expect(isUsable(SHARE_TARGET, [])).toBe(true)
  })
})

describe('stored choice', () => {
  it.each([MAPS_TARGET, SHARE_TARGET, appTarget(osmand)])('round-trips %j', (target) => {
    expect(parseTarget(serializeTarget(target))).toEqual(target)
  })

  it.each([
    ['nothing stored', null],
    ['empty', ''],
    ['not JSON', '{"kind":'],
    ['not an object', '42'],
    ['an unknown kind', '{"kind":"waze"}'],
    ['an app without a package', '{"kind":"app","label":"OsmAnd"}'],
    ['an app with an empty package', '{"kind":"app","packageName":"","label":"OsmAnd"}'],
    ['an app without a name', '{"kind":"app","packageName":"net.osmand"}'],
  ])('treats %s as no choice', (_, text) => {
    expect(parseTarget(text)).toBeNull()
  })

  it('keeps only what it needs from an app', () => {
    expect(parseTarget(JSON.stringify({ ...appTarget(osmand), icon: 'x', extra: 1 }))).toEqual(appTarget(osmand))
  })
})

describe('sameTarget', () => {
  it('compares apps by package and the others by kind', () => {
    expect(sameTarget(appTarget(osmand), { kind: 'app', packageName: 'net.osmand', label: 'OsmAnd+' })).toBe(true)
    expect(sameTarget(appTarget(osmand), appTarget(kurviger))).toBe(false)
    expect(sameTarget(MAPS_TARGET, MAPS_TARGET)).toBe(true)
    expect(sameTarget(MAPS_TARGET, SHARE_TARGET)).toBe(false)
    expect(sameTarget(MAPS_TARGET, null)).toBe(false)
    expect(sameTarget(null, null)).toBe(false)
  })
})

describe('target names', () => {
  const texts: OpenInTexts = { button: 'Open in…', buttonWith: (app) => `Open in ${app}`, googleMaps: 'Google Maps', otherApp: 'Other app (GPX)', downloadGpx: 'Download GPX' }

  it('names each target', () => {
    expect(targetName(appTarget(osmand), texts, true)).toBe('OsmAnd')
    expect(targetName(MAPS_TARGET, texts, true)).toBe('Google Maps')
    expect(targetName(SHARE_TARGET, texts, true)).toBe('Other app (GPX)')
    expect(targetName(SHARE_TARGET, texts, false)).toBe('Download GPX')
  })

  it('says where the button goes, and downloads rather than "opens in a download"', () => {
    expect(buttonLabel(null, texts, true)).toBe('Open in…')
    expect(buttonLabel(appTarget(osmand), texts, true)).toBe('Open in OsmAnd')
    expect(buttonLabel(SHARE_TARGET, texts, true)).toBe('Open in Other app (GPX)')
    expect(buttonLabel(SHARE_TARGET, texts, false)).toBe('Download GPX')
  })
})
