import { en, type Messages } from './en'
import { es } from './es'

export type Locale = 'en' | 'es'

export const LOCALES: Record<Locale, { name: string; messages: Messages }> = {
  es: { name: 'Español', messages: es },
  en: { name: 'English', messages: en },
}

const STORAGE_KEY = 'twisty.locale'
// Riders whose device speaks another language of Spain read Spanish more easily than English.
const SPANISH_LANGUAGES = ['es', 'ca', 'eu', 'gl']

let locale = $state<Locale>(storedLocale() ?? deviceLocale())

/** The active language and its messages; reading them in a component re-renders it when the language changes. */
export const i18n = {
  get locale(): Locale {
    return locale
  },
  set locale(value: Locale) {
    locale = value
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Private browsing: the choice just lasts for this visit.
    }
  },
  get t(): Messages {
    return LOCALES[locale].messages
  },
}

function storedLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'en' || stored === 'es' ? stored : null
  } catch {
    return null
  }
}

function deviceLocale(): Locale {
  const preferred = typeof navigator === 'undefined' ? undefined : navigator.languages?.[0]
  return SPANISH_LANGUAGES.includes(preferred?.slice(0, 2).toLowerCase() ?? '') ? 'es' : 'en'
}
