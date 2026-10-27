import type { APIRoute } from "astro"
import { LOCALE_CODES } from "@/i18n"
import { INDEXABLE_MIN_SAMPLES, getStore } from "@/server/db"
import { xml } from "@/server/http"
import { URLS_PER_SITEMAP, sitemapIndex } from "@/server/sitemap"

export const prerender = false

export const GET: APIRoute = async ({ site }) => {
  const count = (await getStore()).countIndexable(INDEXABLE_MIN_SAMPLES)
  const chunks = Math.ceil(count / URLS_PER_SITEMAP)
  const files = LOCALE_CODES.flatMap((locale) => [
    `/sitemaps/${locale}-pages.xml`,
    ...Array.from({ length: chunks }, (_, i) => `/sitemaps/${locale}-domains-${i}.xml`),
  ])
  return xml(sitemapIndex(site!.origin, files), "public, max-age=3600")
}
