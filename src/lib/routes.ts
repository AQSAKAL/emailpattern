import { DEFAULT_LOCALE, isLocale, type Locale } from "../i18n/locales"
import { normalizeDomain } from "./email/domains"

export type DomainParam =
  | { kind: "ok"; domain: string }
  | { kind: "redirect"; domain: string }
  | { kind: "not-found" }

/** What a /{domain} URL should do: render, redirect to the clean spelling, or 404. */
export function resolveDomainParam(param: string | undefined): DomainParam {
  if (!param || !param.includes(".")) return { kind: "not-found" }
  const domain = normalizeDomain(decodeURIComponent(param))
  if (!domain) return { kind: "not-found" }
  return domain === param ? { kind: "ok", domain } : { kind: "redirect", domain }
}

/** Browse pages exist for a-z and 0-9. */
export function isBrowseLetter(value: string | undefined): value is string {
  return value !== undefined && /^[a-z0-9]$/.test(value)
}

/** Cache headers for server-rendered pages: short in browsers, long at the edge. */
export const PAGE_CACHE = "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800"

/** The language of a /{lang}/… URL; null for unknown codes and for English, which has no prefix. */
export function prefixedLocale(param: string | undefined): Locale | null {
  return isLocale(param) && param !== DEFAULT_LOCALE ? param : null
}
