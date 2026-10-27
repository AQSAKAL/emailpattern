import { LOCALES, LOCALE_CODES, localePath, type Locale } from "../i18n/locales"

export const URLS_PER_SITEMAP = 40_000

/** One <url>, with hreflang alternates for every language unless the page exists in one only. */
function urlEntry(origin: string, locale: Locale, path: string, languages: boolean): string {
  if (!languages) return `<url><loc>${origin}${localePath(locale, path)}</loc></url>`
  const alternates = LOCALE_CODES.map(
    (code) => `<xhtml:link rel="alternate" hreflang="${LOCALES[code].htmlLang}" href="${origin}${localePath(code, path)}"/>`,
  ).join("")
  return `<url><loc>${origin}${localePath(locale, path)}</loc>${alternates}</url>`
}

export function urlSet(origin: string, locale: Locale, paths: readonly string[], languages = true): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${paths.map((p) => urlEntry(origin, locale, p, languages)).join("\n")}
</urlset>`
}

export function sitemapIndex(origin: string, files: readonly string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${files.map((f) => `<sitemap><loc>${origin}${f}</loc></sitemap>`).join("\n")}
</sitemapindex>`
}
