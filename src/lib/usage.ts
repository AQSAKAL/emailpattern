// What the usage log records, as pure calculations: classify a request, hash the
// caller, build the event rows. Writing them to disk is src/server/usage-log.ts.
//
// Privacy by construction: no query strings, no person names and no raw IPs ever
// reach an event. Lookups keep the normalised company domain and whether a name
// was given, nothing more.

import { createHmac } from "node:crypto"
import { DEFAULT_LOCALE, isLocale, type Locale } from "../i18n/locales"
import { normalizeDomain } from "./email/domains"

export type Surface = "page" | "api" | "mcp" | "api_doc" | "seo_file" | "asset"

export interface PathInfo {
  surface: Surface
  lang: Locale
  /** The route with ids replaced by placeholders, e.g. "/[domain]", so rows group by page type. */
  route: string
  domain: string | null
}

const ASSET = /^\/(_astro\/|favicon|logos\/)/
const SEO_FILES = new Set(["/robots.txt", "/llms.txt", "/sitemap.xml"])
const DOMAIN_API = "/api/v1/domains/"

function safeDomain(segment: string): string | null {
  try {
    return normalizeDomain(decodeURIComponent(segment))
  } catch {
    return null
  }
}

export function classifyPath(pathname: string): PathInfo {
  const other = (surface: Surface, route: string, domain: string | null = null): PathInfo => ({
    surface,
    lang: DEFAULT_LOCALE,
    route,
    domain,
  })

  if (ASSET.test(pathname)) return other("asset", pathname)
  if (pathname === "/mcp") return other("mcp", "/mcp")
  if (pathname === "/api/openapi.json") return other("api_doc", pathname)
  if (pathname.startsWith(DOMAIN_API)) return other("api", "/api/v1/domains/[domain]", safeDomain(pathname.slice(DOMAIN_API.length)))
  if (pathname.startsWith("/api/")) return other("api", pathname)
  if (pathname.startsWith("/sitemaps/")) return other("seo_file", "/sitemaps/[file]")
  if (SEO_FILES.has(pathname)) return other("seo_file", pathname)

  const parts = pathname.split("/").filter(Boolean)
  const lang = isLocale(parts[0]) && parts[0] !== DEFAULT_LOCALE ? (parts.shift() as Locale) : DEFAULT_LOCALE
  const page = (route: string, domain: string | null = null): PathInfo => ({ surface: "page", lang, route, domain })

  if (parts.length === 0) return page("/")
  if (parts[0] === "patterns") return page(parts.length === 1 ? "/patterns" : "/patterns/[id]")
  if (parts[0] === "browse") return page("/browse/[letter]")
  const domain = parts.length === 1 ? safeDomain(parts[0]) : null
  return domain ? page("/[domain]", domain) : page("/[other]")
}

export type AgentKind = "browser" | "crawler" | "ai_crawler" | "ai_agent" | "library" | "unknown"

// Order matters: our own clients first, then bots (they all claim to be Mozilla/5.0).
const AGENTS: [RegExp, string, AgentKind][] = [
  [/^emailpattern-cli\//i, "emailpattern-cli", "library"],
  [/^emailpattern-python\//i, "emailpattern-python", "library"],
  [/^emailpattern-npm\//i, "emailpattern-npm", "library"],
  [/Claude-User/i, "Claude-User", "ai_agent"],
  [/ClaudeBot|Claude-SearchBot|anthropic-ai/i, "ClaudeBot", "ai_crawler"],
  [/ChatGPT-User/i, "ChatGPT-User", "ai_agent"],
  [/GPTBot|OAI-SearchBot/i, "GPTBot", "ai_crawler"],
  [/Perplexity-User/i, "Perplexity-User", "ai_agent"],
  [/PerplexityBot/i, "PerplexityBot", "ai_crawler"],
  [/CCBot/i, "CCBot", "ai_crawler"],
  [/Bytespider/i, "Bytespider", "ai_crawler"],
  [/Amazonbot/i, "Amazonbot", "ai_crawler"],
  [/Google-Extended|GoogleOther/i, "Google-Extended", "ai_crawler"],
  [/Meta-ExternalAgent|FacebookBot/i, "Meta", "ai_crawler"],
  [/cohere-ai/i, "cohere-ai", "ai_crawler"],
  [/Googlebot|Google-InspectionTool|AdsBot-Google/i, "Googlebot", "crawler"],
  [/bingbot|BingPreview/i, "Bingbot", "crawler"],
  [/DuckDuckBot/i, "DuckDuckBot", "crawler"],
  [/YandexBot/i, "YandexBot", "crawler"],
  [/Baiduspider/i, "Baiduspider", "crawler"],
  [/Applebot/i, "Applebot", "crawler"],
  [/AhrefsBot/i, "AhrefsBot", "crawler"],
  [/SemrushBot/i, "SemrushBot", "crawler"],
  [/MJ12bot/i, "MJ12bot", "crawler"],
  [/PetalBot|SeznamBot|DotBot|DataForSeoBot|Screaming Frog/i, "other-crawler", "crawler"],
  [/\bbot\b|crawler|spider|slurp/i, "other-crawler", "crawler"],
  [/^curl\//i, "curl", "library"],
  [/python-requests|python-httpx|aiohttp|python-urllib|Python\//i, "python", "library"],
  [/node-fetch|undici|axios|^node$|got \(/i, "node", "library"],
  [/Go-http-client/i, "go", "library"],
  [/okhttp/i, "okhttp", "library"],
  [/^Java\/|Apache-HttpClient/i, "java", "library"],
  [/PostmanRuntime|insomnia/i, "api-tool", "library"],
  [/Edg\//, "Edge", "browser"],
  [/OPR\//, "Opera", "browser"],
  [/Firefox\//, "Firefox", "browser"],
  [/Chrome\/|CriOS\//, "Chrome", "browser"],
  [/Safari\//, "Safari", "browser"],
]

export function classifyAgent(userAgent: string): { family: string; kind: AgentKind } {
  if (!userAgent.trim()) return { family: "none", kind: "unknown" }
  for (const [pattern, family, kind] of AGENTS) if (pattern.test(userAgent)) return { family, kind }
  return { family: "other", kind: "unknown" }
}

/** A stable keyed hash of the caller's IP: repeat users stay recognisable, the address itself is not kept. */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 16)
}

function text(value: unknown, max = 100): string | null {
  return typeof value === "string" && value ? value.slice(0, max) : null
}

export interface RequestExtra {
  /** MCP only: the JSON-RPC method, the tool called and the connecting client. */
  rpc_method: string | null
  tool: string | null
  client: string | null
  client_version: string | null
}

export const NO_EXTRA: RequestExtra = { rpc_method: null, tool: null, client: null, client_version: null }

/** Reads what an MCP request is about from its JSON-RPC body (one message or a batch). */
export function describeRpc(body: unknown): RequestExtra {
  const message = Array.isArray(body) ? body[0] : body
  if (!message || typeof message !== "object") return NO_EXTRA
  const { method, params } = message as { method?: unknown; params?: { name?: unknown; clientInfo?: { name?: unknown; version?: unknown } } }
  const method_ = text(method)
  return {
    rpc_method: method_,
    tool: method_ === "tools/call" ? text(params?.name) : null,
    client: text(params?.clientInfo?.name),
    client_version: text(params?.clientInfo?.version, 40),
  }
}

export interface RequestEvent extends RequestExtra {
  ts: string
  id: string
  method: string
  path: string
  surface: Surface
  lang: Locale
  route: string
  domain: string | null
  status: number
  ms: number
  ip_hash: string
  ua: string
  agent: string
  agent_kind: AgentKind
  referrer_host: string | null
}

export interface RequestInput {
  now: Date
  id: string
  method: string
  url: URL
  status: number
  ms: number
  ip: string
  userAgent: string | null
  referer: string | null
  secret: string
  extra?: RequestExtra
}

function hostOf(referer: string | null): string | null {
  if (!referer) return null
  try {
    return new URL(referer).host.slice(0, 100)
  } catch {
    return null
  }
}

export function buildRequestEvent(input: RequestInput): RequestEvent {
  const info = classifyPath(input.url.pathname)
  const ua = (input.userAgent ?? "").slice(0, 300)
  const agent = classifyAgent(ua)
  return {
    ts: input.now.toISOString(),
    id: input.id,
    method: input.method,
    // pathname only: the query string carries the typed name.
    path: input.url.pathname.slice(0, 200),
    surface: info.surface,
    lang: info.lang,
    route: info.route,
    domain: info.domain,
    status: input.status,
    ms: Math.round(input.ms * 10) / 10,
    ip_hash: hashIp(input.ip, input.secret),
    ua,
    agent: agent.family,
    agent_kind: agent.kind,
    referrer_host: hostOf(input.referer),
    ...(input.extra ?? NO_EXTRA),
  }
}

export interface LookupResultLike {
  domain: string | null
  error: string | null
  known_domain: boolean
  sample_count: number
  candidates: { pattern: string; confidence: number }[]
  mail: { accepts_mail: boolean | null }
}

export interface LookupEvent {
  ts: string
  request_id: string | null
  surface: Surface | null
  /** The normalised company domain; null when the input was not a domain. */
  domain: string | null
  known_domain: boolean
  sample_count: number
  has_name: boolean
  top_pattern: string | null
  top_confidence: number | null
  candidates: number
  error: string | null
  accepts_mail: boolean | null
}

export function buildLookupEvent(input: {
  now: Date
  requestId: string | null
  surface: Surface | null
  name: string | undefined
  result: LookupResultLike
}): LookupEvent {
  const { result } = input
  const top = result.candidates[0]
  return {
    ts: input.now.toISOString(),
    request_id: input.requestId,
    surface: input.surface,
    domain: result.domain,
    known_domain: result.known_domain,
    sample_count: result.sample_count,
    has_name: Boolean(input.name?.trim()),
    top_pattern: top?.pattern ?? null,
    top_confidence: top ? top.confidence : null,
    candidates: result.candidates.length,
    error: result.error,
    accepts_mail: result.mail.accepts_mail,
  }
}
