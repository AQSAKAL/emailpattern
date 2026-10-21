import assert from "node:assert/strict"
import { test } from "node:test"
import { Client, RateLimited } from "../src/api.js"
import { buildProgram, defaultOutput } from "../src/cli.js"
import { palette } from "../src/colors.js"

function result(domain, name, error = null) {
  const local = (name ?? "").toLowerCase().replace(/ /g, ".")
  return {
    query: { domain, name },
    domain: error ? null : domain,
    error,
    company_name: null,
    known_domain: true,
    sample_count: 12,
    candidates: error ? [] : [{ email: name ? `${local}@${domain}` : null, pattern: "first-dot-last", template: `{first}.{last}@${domain}`, confidence: 0.9 }],
    mail: { accepts_mail: true, host: null },
  }
}

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })

async function fakeFetch(url, init = {}) {
  const u = new URL(url)
  if (u.pathname === "/api/v1/find" && (init.method ?? "GET") === "GET") {
    const domain = u.searchParams.get("domain")
    return domain.includes(".") ? json(result(domain, u.searchParams.get("name"))) : json(result(domain, null, "invalid_domain"), 422)
  }
  if (u.pathname === "/api/v1/find") {
    const { queries } = JSON.parse(init.body)
    return json({ results: queries.map((q) => result(q.domain, q.name, q.domain.includes(".") ? null : "invalid_domain")) })
  }
  if (u.pathname.startsWith("/api/v1/domains/")) return json(result(decodeURIComponent(u.pathname.split("/").pop())))
  return json({}, 404)
}

function sink() {
  const chunks = []
  return { write: (s) => chunks.push(s), isTTY: false, text: () => chunks.join("") }
}

async function run(args, files) {
  const stdout = sink()
  const stderr = sink()
  const { program, state } = buildProgram({ client: new Client({ baseUrl: "http://test", fetch: fakeFetch }), stdout, stderr, files, colors: palette(false) })
  program.exitOverride()
  await program.parseAsync(args, { from: "user" })
  return { out: stdout.text(), err: stderr.text(), code: state.exitCode }
}

test("find prints the address", async () => {
  const { out, code } = await run(["find", "Jane Doe", "acme.com"])
  assert.equal(code, 0)
  assert.match(out, /jane\.doe@acme\.com/)
})

test("find --json prints the raw result", async () => {
  const { out } = await run(["find", "Jane Doe", "acme.com", "--json"])
  assert.equal(JSON.parse(out).candidates[0].email, "jane.doe@acme.com")
})

test("find with a bad domain exits 2", async () => {
  const { out, code } = await run(["find", "Jane", "nope"])
  assert.equal(code, 2)
  assert.match(out, /doesn't look like a website/)
})

test("domain lists formats", async () => {
  const { out, code } = await run(["domain", "acme.com"])
  assert.equal(code, 0)
  assert.match(out, /\{first\}\.\{last\}/)
})

test("bulk writes an enriched copy next to the source", async () => {
  const written = {}
  const files = {
    readFile: async () => "Full Name,Website\nJane Doe,acme.com\nBob,nope\n",
    writeFile: async (path, text) => (written[path] = text),
  }
  const { code } = await run(["bulk", "/tmp/leads.csv"], files)
  assert.equal(code, 0)
  const lines = written["/tmp/leads.emails.csv"].trim().split("\n")
  assert.equal(lines[0], "Full Name,Website,email,pattern,confidence,known_domain,accepts_mail,error")
  assert.ok(lines[1].startsWith("Jane Doe,acme.com,jane.doe@acme.com"))
  assert.ok(lines[2].endsWith("invalid_domain"))
})

test("bulk without recognisable columns fails clearly", async () => {
  const { err, code } = await run(["bulk", "x.csv"], { readFile: async () => "a,b\n1,2\n", writeFile: async () => {} })
  assert.equal(code, 1)
  assert.match(err, /--name-column/)
})

test("findMany waits out a rate limit and retries", async () => {
  let calls = 0
  const waits = []
  const client = new Client({
    baseUrl: "http://test",
    sleep: async (ms) => waits.push(ms),
    fetch: async (url, init) => (++calls === 1 ? json({ error: "rate_limited" }, 429, { "retry-after": "2" }) : fakeFetch(url, init)),
  })
  const results = await client.findMany([{ domain: "acme.com", name: "Jane Doe" }])
  assert.equal(results[0].candidates[0].email, "jane.doe@acme.com")
  assert.deepEqual(waits, [2000])
})

test("findMany gives up after its retries", async () => {
  const client = new Client({ baseUrl: "http://test", sleep: async () => {}, fetch: async () => json({}, 429, { "retry-after": "1" }) })
  await assert.rejects(client.findMany([{ domain: "a.com" }], 1), RateLimited)
})

test("default output sits next to the source", () => {
  assert.equal(defaultOutput("/data/leads.csv"), "/data/leads.emails.csv")
})
