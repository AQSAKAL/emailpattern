import type { APIRoute } from "astro"
import { isLocale } from "@/i18n"
import { PATTERNS } from "@/lib/email/patterns"
import { INDEXABLE_MIN_SAMPLES, getStore } from "@/server/db"
import { xml } from "@/server/http"
import { URLS_PER_SITEMAP, urlSet } from "@/server/sitemap"

export const prerender = false

const BROWSE = [..."abcdefghijklmnopqrstuvwxyz0123456789"].map((c) => `/browse/${c}`)

/** /sitemaps/de-pages.xml and /sitemaps/de-domains-3.xml */
export const GET: APIRoute = async ({ params, site }) => {
  const match = /^([a-z]{2})-(pages|domains-(\d+))$/.exec(params.file ?? "")
  if (!match || !isLocale(match[1])) return new Response(null, { status: 404 })
  const locale = match[1]
  const origin = site!.origin

  if (match[2] === "pages") {
    const paths = ["/", "/patterns", ...PATTERNS.map((p) => `/patterns/${p.id}`), ...BROWSE]
    return xml(urlSet(origin, locale, paths), "public, max-age=86400")
  }

  const page = Number(match[3])
  const domains = (await getStore()).domainPage(page * URLS_PER_SITEMAP, URLS_PER_SITEMAP, INDEXABLE_MIN_SAMPLES)
  if (domains.length === 0) return new Response(null, { status: 404 })
  return xml(urlSet(origin, locale, domains.map((d) => `/${d}`)), "public, max-age=86400")
}
