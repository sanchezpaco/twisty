import { i18n } from './i18n/i18n.svelte'

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`
}

export function formatExtra(seconds: number): string {
  return seconds < 60 ? i18n.t.ride.fastest : `+${formatDuration(seconds)}`
}

/** One decimal below 10 km, whole kilometres above, with the active language's separators. */
export function formatKm(meters: number): string {
  const km = meters / 1000
  const digits = km < 10 ? 1 : 0
  return formatNumber(km, digits)
}

const formatters = new Map<string, Intl.NumberFormat>()

/** Building an Intl.NumberFormat is slow enough to show when a list formats dozens of numbers, so keep one per language and precision. */
function numberFormat(digits: number): Intl.NumberFormat {
  const key = `${i18n.locale}:${digits}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(i18n.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    formatters.set(key, formatter)
  }
  return formatter
}

export function formatNumber(value: number, digits = 0): string {
  return numberFormat(digits).format(value)
}
