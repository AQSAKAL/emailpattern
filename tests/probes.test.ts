import { describe, expect, it } from "vitest"
import { countMiss, isBanned, isProbe, isTrustedCrawler, MISS_LIMIT, MISS_WINDOW_MS } from "../src/lib/probes"

describe("isProbe", () => {
  it("flags secret files, scripts and admin panels seen in the logs", () => {
    for (const path of [
      "/.env", "/.env.production", "/backend/.env", "/.git/config", "/.aws/credentials", "/.ssh/id_rsa", "/.npmrc",
      "/wp-login.php", "/wp-admin/plugins.php", "/wp-json/wp/v2/users", "/xmlrpc.php", "/config.php.bak",
      "/phpmyadmin/", "/actuator/health", "/cgi-bin/luci", "/docker-compose.yml", "/config.json", "/%2eenv",
      "/var/www/.env", "/wp-content/debug.log", "/backup.sql", "/server.key", "/supabase/config.toml", "/service_account.json", "/firebase-adminsdk.json.bak",
    ]) expect(isProbe(path), path).toBe(true)
  })

  it("leaves the site's own pages and things a curious person might type alone", () => {
    for (const path of [
      "/", "/acme.com", "/fr/foxway.com", "/de/browse/p", "/patterns/first-dot-last", "/api/v1/find", "/mcp",
      "/robots.txt", "/sitemap.xml", "/llms.txt", "/.well-known/security.txt", "/admin", "/login", "/dashboard",
      "/favicon.ico", "/_astro/app.js", "/envato.com", "/gitlab.com", "/php.net", "/wordpress.com", "/jenkins.io", "/solr.apache.org", "/awa.pl", "/de/robertsen.no", "/fr/elfimo.cz",
    ]) expect(isProbe(path), path).toBe(false)
  })
})

describe("isTrustedCrawler", () => {
  it("trusts a crawler only from its operator's network", () => {
    expect(isTrustedCrawler("crawler", "Google LLC")).toBe(true)
    expect(isTrustedCrawler("ai_agent", "Microsoft Corporation")).toBe(true)
    expect(isTrustedCrawler("ai_crawler", "TECHOFF SRV LIMITED")).toBe(false)
    expect(isTrustedCrawler("crawler", null)).toBe(false)
    expect(isTrustedCrawler("browser", "Google LLC")).toBe(false)
  })
})

describe("isBanned", () => {
  it("holds until the ban ends", () => {
    const bans = new Map([["198.51.100.1", 1_000]])
    expect(isBanned(bans, "198.51.100.1", 999)).toBe(true)
    expect(isBanned(bans, "198.51.100.1", 1_000)).toBe(false)
    expect(isBanned(bans, "198.51.100.2", 0)).toBe(false)
  })
})

describe("countMiss", () => {
  it("bans after the limit of not-found answers inside the window", () => {
    let misses = undefined as ReturnType<typeof countMiss>["misses"] | undefined
    let ban = false
    for (let i = 0; i < MISS_LIMIT; i++) ({ misses, ban } = countMiss(misses, i * 1000))
    expect(ban).toBe(true)
  })

  it("starts over once the window has passed", () => {
    const first = countMiss({ count: MISS_LIMIT - 1, since: 0 }, MISS_WINDOW_MS)
    expect(first).toEqual({ misses: { count: 1, since: MISS_WINDOW_MS }, ban: false })
  })
})
