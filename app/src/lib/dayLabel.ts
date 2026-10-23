import type { Locale } from './i18n/i18n.svelte'
import { daysAgo } from './tripHistory'

// Plain "en" formats a date the American way (Oct 12); the app's English is the European one (12 Oct).
const DATE_LOCALES: Record<Locale, string> = { en: 'en-GB', es: 'es' }

/** "Today", "Yesterday" or a day and short month, in the rider's language and time zone. */
export function dayLabel(at: number, now: number, locale: Locale, words: { today: string; yesterday: string }): string {
  const days = daysAgo(at, now)
  if (days <= 0) return words.today
  if (days === 1) return words.yesterday
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], { day: 'numeric', month: 'short' }).format(at)
}
