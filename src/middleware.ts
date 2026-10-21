import { defineMiddleware } from "astro:middleware"
import { take, type Bucket, type Limit } from "./lib/rate-limit"

// Per-IP limit for the API and MCP endpoint. In-memory, so it is per process;
// enough for one server, move to a shared store if the app ever scales out.
const LIMIT: Limit = { capacity: 60, refillPerSecond: 1 }
const MAX_TRACKED = 100_000
const buckets = new Map<string, Bucket>()
const TRUST_PROXY = process.env.TRUST_PROXY === "1"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, mcp-session-id, mcp-protocol-version, last-event-id",
  "access-control-expose-headers": "mcp-session-id",
}

function isMachineRoute(pathname: string): boolean {
  return pathname.startsWith("/api/v1/") || pathname === "/mcp"
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url
  if (!isMachineRoute(pathname)) return next()
  if (context.request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

  const forwarded = TRUST_PROXY ? context.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined
  const ip = forwarded || context.clientAddress
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
})
