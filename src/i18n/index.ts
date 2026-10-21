import { de } from "./dictionaries/de"
import { en, type Dictionary } from "./dictionaries/en"
import { es } from "./dictionaries/es"
import { fr } from "./dictionaries/fr"
import type { Locale } from "./locales"

export * from "./locales"
export { fill, splitPlaceholders } from "./fill"
export type { Dictionary, FinderStrings } from "./dictionaries/en"

const DICTIONARIES: Record<Locale, Dictionary> = { en, de, fr, es }

export function dictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}

export function patternLabel(t: Dictionary, patternId: string): string {
  return (t.patternLabels as Record<string, string>)[patternId] ?? patternId
}
