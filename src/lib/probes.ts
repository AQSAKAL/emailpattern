// Scanners that enumerate secrets and admin panels (/.env, /.git/config, /wp-login.php…)
// get their IP banned for a while. The site has no such files, so no visitor asks for
// them; crawlers can follow a stray link to one, so a real crawler is only answered 404.

import type { AgentKind } from "./usage"

// Dot-files and folders (except /.well-known), server-side scripts, WordPress and
// friends, and backup or key files.
const PROBE = new RegExp(
  [
    String.raw`(^|/)\.(?!well-known(/|$))[^/]`,
    String.raw`\.(php\d?|phtml|asp|aspx|ashx|jsp|jspx|cgi|env|ini|sql|bak|old|orig|swp|pem|key|p12|pfx|tar|tgz|gz|rar|7z|toml)$`,
    String.raw`(^|/)(wp-admin|wp-content|wp-includes|wp-json|wordpress|xmlrpc|phpmyadmin|pma|adminer|cgi-bin|actuator|vendor/phpunit|owa|ecp|autodiscover|hnap1|boaform|solr|jenkins|server-status|telescope)(/|$)`,
    String.raw`(^|/)(id_rsa|id_ed25519|credentials|docker-compose\.ya?ml|config\.(json|ya?ml)|secrets?\.(json|ya?ml)|database\.yml|appsettings\.json|web\.config|service[_-]account\.json|firebase[^/]*\.json)$`,
  ].join("|"),
  "i",
)

export function isProbe(pathname: string): boolean {
  let path = pathname
  try {
    path = decodeURIComponent(pathname)
  } catch {
    // keep the raw path
  }
  return PROBE.test(path)
}

const CRAWLER_KINDS = new Set<AgentKind>(["crawler", "ai_crawler", "ai_agent"])
// Networks the big crawlers and AI fetchers run from. A scanner that only borrows a
// crawler's name from a rented server elsewhere is banned like any other.
const CRAWLER_NETWORKS = /google|microsoft|amazon|apple|anthropic|openai|meta platforms|facebook|yandex|baidu|bytedance|perplexity|cloudflare|duckduckgo/i

export function isTrustedCrawler(kind: AgentKind, networkOwner: string | null): boolean {
  return CRAWLER_KINDS.has(kind) && networkOwner !== null && CRAWLER_NETWORKS.test(networkOwner)
}

export const BAN_MS = 24 * 3600 * 1000

// Enumerating paths that do not exist (/admin, /api-keys, /graphql…) is the other tell:
// this many not-found answers inside the window bans the IP too.
export const MISS_LIMIT = 10
export const MISS_WINDOW_MS = 10 * 60 * 1000

export interface Misses {
  count: number
  since: number
}

/** Counts one not-found answer; the window restarts once it has passed. */
export function countMiss(previous: Misses | undefined, now: number): { misses: Misses; ban: boolean } {
  const misses = previous && now - previous.since < MISS_WINDOW_MS ? { count: previous.count + 1, since: previous.since } : { count: 1, since: now }
  return { misses, ban: misses.count >= MISS_LIMIT }
}

/** Bans as plain data: IP to the time the ban ends. The middleware owns the map. */
export function isBanned(bans: ReadonlyMap<string, number>, ip: string, now: number): boolean {
  const until = bans.get(ip)
  return until !== undefined && until > now
}
