import type { APIRoute } from "astro"
import { DEFAULT_LOCALE, isLocale } from "@/i18n"
import { PATTERNS } from "@/lib/email/patterns"
import { INDEXABLE_MIN_SAMPLES, getStore } from "@/server/db"
import { xml } from "@/server/http"
import { URLS_PER_SITEMAP, urlSet } from "@/server/sitemap"

export const prerender = false


/** /sitemaps/de-pages.xml, /sitemaps/de-domains-3.xml and /sitemaps/en-released-0.xml */
export const GET: APIRoute = async ({ params, site }) => {
  const match = /^([a-z]{2})-(pages|domains-(\d+)|released-(\d+))$/.exec(params.file ?? "")
  if (!match || !isLocale(match[1])) return new Response(null, { status: 404 })
  const locale = match[1]
  const origin = site!.origin

  if (match[2] === "pages") {
    // Browse pages are noindex (they answer no search), so they stay out of the sitemap.
    const paths = ["/", "/patterns", ...PATTERNS.map((p) => `/patterns/${p.id}`)]
    return xml(urlSet(origin, locale, paths), "public, max-age=86400")
  }

  if (match[4] !== undefined) {
    if (locale !== DEFAULT_LOCALE) return new Response(null, { status: 404 })
    const released = (await getStore()).releasedPage(Number(match[4]) * URLS_PER_SITEMAP, URLS_PER_SITEMAP)
    if (released.length === 0) return new Response(null, { status: 404 })
    return xml(urlSet(origin, locale, released.map((d) => `/${d}`), false), "public, max-age=86400")
  }

  const page = Number(match[3])
  const domains = (await getStore()).domainPage(page * URLS_PER_SITEMAP, URLS_PER_SITEMAP, INDEXABLE_MIN_SAMPLES)
  if (domains.length === 0) return new Response(null, { status: 404 })
  return xml(urlSet(origin, locale, domains.map((d) => `/${d}`)), "public, max-age=86400")
}
