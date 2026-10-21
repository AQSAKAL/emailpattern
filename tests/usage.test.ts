import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { buildLookupEvent, buildRequestEvent, classifyAgent, classifyPath, describeRpc, hashIp } from "../src/lib/usage"
import { createUsageLog } from "../src/server/usage-log"

describe("classifyPath", () => {
  it.each([
    ["/", { surface: "page", lang: "en", route: "/", domain: null }],
    ["/de", { surface: "page", lang: "de", route: "/", domain: null }],
    ["/de/", { surface: "page", lang: "de", route: "/", domain: null }],
    ["/stripe.com", { surface: "page", lang: "en", route: "/[domain]", domain: "stripe.com" }],
    ["/fr/Stripe.COM", { surface: "page", lang: "fr", route: "/[domain]", domain: "stripe.com" }],
    ["/patterns", { surface: "page", lang: "en", route: "/patterns", domain: null }],
    ["/es/patterns/flast", { surface: "page", lang: "es", route: "/patterns/[id]", domain: null }],
    ["/browse/a", { surface: "page", lang: "en", route: "/browse/[letter]", domain: null }],
    ["/wp-admin", { surface: "page", lang: "en", route: "/[other]", domain: null }],
    ["/%E0%A4%A", { surface: "page", lang: "en", route: "/[other]", domain: null }],
    ["/api/v1/find", { surface: "api", lang: "en", route: "/api/v1/find", domain: null }],
    ["/api/v1/domains/acme.com", { surface: "api", lang: "en", route: "/api/v1/domains/[domain]", domain: "acme.com" }],
    ["/api/openapi.json", { surface: "api_doc", lang: "en", route: "/api/openapi.json", domain: null }],
    ["/mcp", { surface: "mcp", lang: "en", route: "/mcp", domain: null }],
    ["/robots.txt", { surface: "seo_file", lang: "en", route: "/robots.txt", domain: null }],
    ["/sitemaps/de-pages.xml", { surface: "seo_file", lang: "en", route: "/sitemaps/[file]", domain: null }],
    ["/_astro/app.abc.js", { surface: "asset", lang: "en", route: "/_astro/app.abc.js", domain: null }],
  ])("%s", (path, expected) => {
    expect(classifyPath(path)).toEqual(expected)
  })
})

describe("classifyAgent", () => {
  it.each([
    ["Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Chrome", "browser"],
    ["Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0", "Edge", "browser"],
    ["Mozilla/5.0 (X11; Linux) Gecko/20100101 Firefox/131.0", "Firefox", "browser"],
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Googlebot", "crawler"],
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", "ClaudeBot", "ai_crawler"],
    ["Mozilla/5.0 AppleWebKit/537.36; compatible; ChatGPT-User/1.0", "ChatGPT-User", "ai_agent"],
    ["curl/8.7.1", "curl", "library"],
    ["python-httpx/0.27.0", "python", "library"],
    ["Go-http-client/2.0", "go", "library"],
    ["node", "node", "library"],
    ["", "none", "unknown"],
    ["something-unheard-of/1.0", "other", "unknown"],
  ])("%s", (ua, family, kind) => {
    expect(classifyAgent(ua)).toEqual({ family, kind })
  })
})

describe("hashIp", () => {
  it("is stable for one secret and different across secrets and addresses", () => {
    expect(hashIp("203.0.113.7", "a")).toBe(hashIp("203.0.113.7", "a"))
    expect(hashIp("203.0.113.7", "a")).not.toBe(hashIp("203.0.113.7", "b"))
    expect(hashIp("203.0.113.7", "a")).not.toBe(hashIp("203.0.113.8", "a"))
    expect(hashIp("203.0.113.7", "a")).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe("describeRpc", () => {
  it("reads the client from initialize", () => {
    const body = { jsonrpc: "2.0", id: 1, method: "initialize", params: { clientInfo: { name: "claude-code", version: "2.1.0" } } }
    expect(describeRpc(body)).toEqual({ rpc_method: "initialize", tool: null, client: "claude-code", client_version: "2.1.0" })
  })

  it("reads the tool from tools/call, in a batch too", () => {
    const call = { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "find_email", arguments: { people: [] } } }
    expect(describeRpc(call).tool).toBe("find_email")
    expect(describeRpc([call]).tool).toBe("find_email")
  })

  it("copes with anything else", () => {
    for (const body of [null, "x", 3, [], {}]) expect(describeRpc(body).rpc_method).toBeNull()
  })
})

describe("buildRequestEvent", () => {
  const input = {
    now: new Date("2026-10-21T10:00:00.123Z"),
    id: "abc",
    method: "GET",
    url: new URL("https://emailpattern.com/api/v1/find?domain=acme.com&name=Jane%20Doe"),
    status: 200,
    ms: 12.345,
    ip: "203.0.113.7",
    userAgent: "curl/8.7.1",
    referer: "https://news.example/some/article?x=1",
    secret: "s3cret",
  }

  it("keeps the query string, names and the raw IP out of the row", () => {
    const row = JSON.stringify(buildRequestEvent(input))
    expect(row).not.toContain("Jane")
    expect(row).not.toContain("name=")
    expect(row).not.toContain("203.0.113.7")
    expect(row).not.toContain("/some/article")
  })

  it("fills the classified columns", () => {
    expect(buildRequestEvent(input)).toMatchObject({
      ts: "2026-10-21T10:00:00.123Z",
      path: "/api/v1/find",
      surface: "api",
      route: "/api/v1/find",
      status: 200,
      ms: 12.3,
      agent: "curl",
      agent_kind: "library",
      referrer_host: "news.example",
      rpc_method: null,
    })
  })
})

describe("buildLookupEvent", () => {
  const result = {
    domain: "acme.com",
    error: null,
    known_domain: true,
    sample_count: 41,
    candidates: [{ pattern: "flast", confidence: 0.8 }, { pattern: "first-dot-last", confidence: 0.1 }],
    mail: { accepts_mail: true },
  }

  it("records the domain and outcome but not the name", () => {
    const event = buildLookupEvent({ now: new Date("2026-10-21T10:00:00Z"), requestId: "abc", surface: "mcp", name: "Jane Doe", result })
    expect(event).toMatchObject({ domain: "acme.com", has_name: true, top_pattern: "flast", top_confidence: 0.8, candidates: 2, request_id: "abc", surface: "mcp" })
    expect(JSON.stringify(event)).not.toContain("Jane")
  })

  it("marks a lookup without a name and one that failed", () => {
    const failed = { ...result, domain: null, error: "invalid_domain", known_domain: false, sample_count: 0, candidates: [], mail: { accepts_mail: null } }
    const event = buildLookupEvent({ now: new Date(), requestId: null, surface: null, name: undefined, result: failed })
    expect(event).toMatchObject({ domain: null, has_name: false, top_pattern: null, top_confidence: null, error: "invalid_domain" })
  })
})

describe("createUsageLog", () => {
  const dirs: string[] = []
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  async function tempDir() {
    const dir = await mkdtemp(join(tmpdir(), "usage-"))
    dirs.push(dir)
    return dir
  }

  const request = (ts: string) => buildRequestEvent({
    now: new Date(ts), id: "r", method: "GET", url: new URL("https://emailpattern.com/"), status: 200, ms: 1, ip: "1.1.1.1", userAgent: null, referer: null, secret: "s",
  })

  it("appends one JSON line per event into a file per kind and UTC day", async () => {
    const dir = await tempDir()
    const log = createUsageLog({ dir })
    log.request(request("2026-10-21T23:59:59Z"))
    log.request(request("2026-10-22T00:00:01Z"))
    log.request(request("2026-10-22T00:00:02Z"))
    await log.flush()
    await log.flush()

    expect((await readdir(dir)).sort()).toEqual(["requests-2026-10-21.jsonl", "requests-2026-10-22.jsonl"])
    const lines = (await readFile(join(dir, "requests-2026-10-22.jsonl"), "utf8")).trim().split("\n")
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]).ts).toBe("2026-10-22T00:00:01.000Z")
  })

  it("writes what is queued when flushed synchronously at shutdown", async () => {
    const dir = await tempDir()
    const log = createUsageLog({ dir })
    log.request(request("2026-10-21T10:00:00Z"))
    log.flushSync()
    expect(await readdir(dir)).toEqual(["requests-2026-10-21.jsonl"])
  })

  it("drops events past the buffer cap instead of growing", async () => {
    const dir = await tempDir()
    const log = createUsageLog({ dir, maxBuffered: 2 })
    for (let i = 0; i < 5; i++) log.request(request("2026-10-21T10:00:00Z"))
    await log.flush()
    const lines = (await readFile(join(dir, "requests-2026-10-21.jsonl"), "utf8")).trim().split("\n")
    expect(lines).toHaveLength(2)
  })
})
