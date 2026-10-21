import { formatShare } from "./format"

// Languages the site is served in. English lives at the root, every other
// language under its code: /stripe.com, /de/stripe.com.
// Adding a language: a dictionary in ./dictionaries and one entry here.

export const LOCALES = {
  en: { name: "English", htmlLang: "en", ogLocale: "en_US" },
  de: { name: "Deutsch", htmlLang: "de", ogLocale: "de_DE" },
  fr: { name: "Français", htmlLang: "fr", ogLocale: "fr_FR" },
  es: { name: "Español", htmlLang: "es", ogLocale: "es_ES" },
} as const

export type Locale = keyof typeof LOCALES

export const DEFAULT_LOCALE: Locale = "en"
export const LOCALE_CODES = Object.keys(LOCALES) as Locale[]

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && value in LOCALES
}

/** The URL of `path` (always starting with "/") in a language. */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path
  return path === "/" ? `/${locale}/` : `/${locale}${path}`
}

/** `path` with any language prefix removed, so it can be re-localised. */
export function unlocalizedPath(pathname: string): string {
  const [, first, ...rest] = pathname.split("/")
  if (isLocale(first) && first !== DEFAULT_LOCALE) return `/${rest.join("/")}`
  return pathname
}

export function formatPercent(locale: Locale, share: number): string {
  return formatShare(LOCALES[locale].htmlLang, share)
}

export function formatNumber(locale: Locale, n: number): string {
  return new Intl.NumberFormat(LOCALES[locale].htmlLang).format(n)
}
