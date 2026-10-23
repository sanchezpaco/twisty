import type { OpenInTarget } from './openIn'

const STORAGE_KEY = 'twisty.openIn'

export const serializeTarget = (target: OpenInTarget): string => JSON.stringify(target)

/** Stored text is outside the app's control (older versions, a cleared half-write): anything odd means no choice. */
export function parseTarget(text: string | null): OpenInTarget | null {
  if (!text) return null
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const { kind, packageName, label } = data as Record<string, unknown>
  if (kind === 'maps' || kind === 'share') return { kind }
  if (kind === 'app' && typeof packageName === 'string' && packageName && typeof label === 'string' && label) {
    return { kind, packageName, label }
  }
  return null
}

export function saveTarget(target: OpenInTarget | null): void {
  try {
    if (target) localStorage.setItem(STORAGE_KEY, serializeTarget(target))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private browsing or a full quota: the choice just does not survive a restart.
  }
}

export function loadTarget(): OpenInTarget | null {
  try {
    return parseTarget(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}
