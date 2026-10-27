import type { APIRoute } from "astro"
import { DEFAULT_LOCALE, LOCALE_CODES } from "@/i18n"
import { INDEXABLE_MIN_SAMPLES, getStore } from "@/server/db"
import { xml } from "@/server/http"
import { URLS_PER_SITEMAP, sitemapIndex } from "@/server/sitemap"

export const prerender = false

export const GET: APIRoute = async ({ site }) => {
  const store = await getStore()
  const chunks = Math.ceil(store.countIndexable(INDEXABLE_MIN_SAMPLES) / URLS_PER_SITEMAP)
  // Released pages (no address evidence yet) are indexed in English only.
  const released = Math.ceil(store.countReleased() / URLS_PER_SITEMAP)
  const files = [
    ...LOCALE_CODES.flatMap((locale) => [
      `/sitemaps/${locale}-pages.xml`,
      ...Array.from({ length: chunks }, (_, i) => `/sitemaps/${locale}-domains-${i}.xml`),
    ]),
    ...Array.from({ length: released }, (_, i) => `/sitemaps/${DEFAULT_LOCALE}-released-${i}.xml`),
  ]
  return xml(sitemapIndex(site!.origin, files), "public, max-age=3600")
}
