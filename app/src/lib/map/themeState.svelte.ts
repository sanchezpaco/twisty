import { DEFAULT_THEME, type MapTheme, parseTheme } from './theme'

const STORAGE_KEY = 'twisty.mapTheme'

function loadTheme(): MapTheme {
  try {
    return parseTheme(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_THEME
  }
}

/** The map style the rider chose; dark until they choose another. */
export const mapTheme = $state<{ current: MapTheme }>({ current: loadTheme() })

export function chooseTheme(theme: MapTheme): void {
  mapTheme.current = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Private browsing or a full quota: the choice just does not survive a restart.
  }
}

/** A run of satellite tiles failed to load: the rider is told and offered the dark map, never switched. */
export const imagery = $state({ unavailable: false })
