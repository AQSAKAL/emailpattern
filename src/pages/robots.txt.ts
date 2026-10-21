import type { APIRoute } from "astro"

// Not prerendered, so the usage log sees crawlers fetching it.
export const prerender = false

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /mcp\n\nSitemap: ${new URL("/sitemap.xml", site)}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
