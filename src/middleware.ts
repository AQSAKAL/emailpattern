import { randomBytes } from "node:crypto"
import { defineMiddleware } from "astro:middleware"
import type { APIContext, MiddlewareNext } from "astro"
import { BAN_MS, countMiss, isBanned, isProbe, isTrustedCrawler, type Misses } from "./lib/probes"
import { take, type Bucket, type Limit } from "./lib/rate-limit"
import { classifyAgent, classifyPath, type Blocked } from "./lib/usage"
import { lookupGeo } from "./server/geo"
import { currentRequest, runWithRequest } from "./server/request-context"
import { logRequest } from "./server/usage"

// Per-IP limit for the API and MCP endpoint. In-memory, so it is per process;
// enough for one server, move to a shared store if the app ever scales out.
const LIMIT: Limit = { capacity: 60, refillPerSecond: 1 }
const MAX_TRACKED = 100_000
const buckets = new Map<string, Bucket>()
const TRUST_PROXY = process.env.TRUST_PROXY === "1"
// IPs that went looking for secrets or admin panels, to the time their ban ends.
const bans = new Map<string, number>()
const misses = new Map<string, Misses>()

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, mcp-session-id, mcp-protocol-version, last-event-id",
  "access-control-expose-headers": "mcp-session-id",
}

function isMachineRoute(pathname: string): boolean {
  return pathname.startsWith("/api/v1/") || pathname === "/mcp"
}

function clientIp(context: APIContext): string {
  const forwarded = TRUST_PROXY ? context.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined
  try {
    return forwarded || context.clientAddress
  } catch {
    return "unknown"
  }
}

/** Rate limits and CORS for the API and MCP; every other route passes straight through. */
async function serve(context: APIContext, next: MiddlewareNext, ip: string): Promise<Response> {
  const { pathname } = context.url
  if (!isMachineRoute(pathname)) return next()
  if (context.request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

  const decision = take(buckets.get(ip), Date.now(), LIMIT)
  if (buckets.size >= MAX_TRACKED && !buckets.has(ip)) buckets.delete(buckets.keys().next().value!)
  buckets.set(ip, decision.bucket)

  if (!decision.allowed) {
    return new Response(JSON.stringify({ error: "rate_limited", retry_after_seconds: decision.retryAfterSeconds }), {
      status: 429,
      headers: { ...CORS, "content-type": "application/json", "retry-after": String(decision.retryAfterSeconds) },
    })
  }

  const response = await next()
  for (const [key, value] of Object.entries(CORS)) response.headers.set(key, value)
  return response
}

// With a body, so Astro does not swap in the 404 page (and run this middleware again).
function refuse(status: 403 | 404): Response {
  return new Response(status === 404 ? "Not found\n" : "Forbidden\n", { status, headers: { "content-type": "text/plain", "cache-control": "no-store" } })
}

/** Keeps a map under MAX_TRACKED by dropping its oldest entries. */
function makeRoom<K, V>(map: Map<K, V>): void {
  for (const key of map.keys()) {
    if (map.size < MAX_TRACKED) return
    map.delete(key)
  }
}

/** Bans the IP for a while, unless it comes from a real crawler's network. */
function ban(context: APIContext, ip: string, now: number): void {
  const kind = classifyAgent(context.request.headers.get("user-agent") ?? "").kind
  if (isTrustedCrawler(kind, lookupGeo(ip).as_org)) return
  makeRoom(bans)
  bans.set(ip, now + BAN_MS)
  misses.delete(ip)
}

function screen(context: APIContext, ip: string, now: number): Blocked | null {
  if (isBanned(bans, ip, now)) return "banned"
  if (!isProbe(context.url.pathname)) return null
  ban(context, ip, now)
  return "probe"
}

function noteStatus(context: APIContext, ip: string, status: number, now: number): void {
  if (status !== 404) return
  const counted = countMiss(misses.get(ip), now)
  if (counted.ban) return ban(context, ip, now)
  makeRoom(misses)
  misses.set(ip, counted.misses)
}

export const onRequest = defineMiddleware(async (context, next) => {
  // A rewrite (to /404, say) runs the middleware again inside the same request: log it once.
  if (currentRequest()) return next()
  const surface = classifyPath(context.url.pathname).surface
  if (surface === "asset") return next()

  const ip = clientIp(context)
  const started = performance.now()
  return runWithRequest(randomBytes(8).toString("hex"), surface, async (request) => {
    let status = 500
    const blocked = ip === "unknown" ? null : screen(context, ip, Date.now())
    try {
      const response = blocked === "banned" ? refuse(403) : blocked === "probe" ? refuse(404) : await serve(context, next, ip)
      status = response.status
      if (!blocked && ip !== "unknown") noteStatus(context, ip, status, Date.now())
      return response
    } finally {
      logRequest({
        request,
        method: context.request.method,
        url: context.url,
        status,
        ms: performance.now() - started,
        ip,
        userAgent: context.request.headers.get("user-agent"),
        referer: context.request.headers.get("referer"),
        host: context.request.headers.get("host"),
        acceptLanguage: context.request.headers.get("accept-language"),
        blocked,
      })
    }
  })
})
