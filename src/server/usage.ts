import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { buildLookupEvent, buildRequestEvent, type Blocked, type RequestEvent } from "../lib/usage"
import { lookupGeo } from "./geo"
import { currentRequest, type RequestContext } from "./request-context"
import { createUsageLog, type UsageLog } from "./usage-log"

// Wires the usage log into the process: where the files go, the secret that keys the IP
// hashes, and flushing on shutdown. Turn it off with USAGE_LOG=off.

const DATA_DIR = resolve(process.env.DATA_DIR ?? "data")
const DIR = resolve(DATA_DIR, "usage")

interface Usage {
  log: UsageLog | null
  secret: string
}

/** USAGE_SECRET if set, otherwise a random one kept next to (not inside) the usage folder, so syncing the logs does not copy it. */
function loadSecret(): string {
  if (process.env.USAGE_SECRET) return process.env.USAGE_SECRET
  const file = resolve(DATA_DIR, "usage.secret")
  if (existsSync(file)) return readFileSync(file, "utf8").trim()
  mkdirSync(DATA_DIR, { recursive: true })
  const secret = randomBytes(32).toString("hex")
  writeFileSync(file, secret, { mode: 0o600 })
  return secret
}

function create(): Usage {
  if (process.env.USAGE_LOG === "off") return { log: null, secret: "" }
  const log = createUsageLog({ dir: DIR })
  log.start()
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      log.flushSync()
      process.exit(0)
    })
  }
  return { log, secret: loadSecret() }
}

// On globalThis so dev-server module reloads reuse one timer and one set of handlers.
const holder = globalThis as { __emailpatternUsage?: Usage }
const usage = (): Usage => (holder.__emailpatternUsage ??= create())

export interface RecordedRequest {
  request: RequestContext
  method: string
  url: URL
  status: number
  ms: number
  ip: string
  userAgent: string | null
  referer: string | null
  host: string | null
  acceptLanguage: string | null
  blocked: Blocked | null
}

export function logRequest(recorded: RecordedRequest): void {
  const { log, secret } = usage()
  if (!log) return
  const { request, ...rest } = recorded
  log.request(buildRequestEvent({ now: new Date(), id: request.id, secret, extra: request.extra, geo: lookupGeo(rest.ip), ...rest }) satisfies RequestEvent)
}

interface LookupLike {
  query: { name?: string }
  result: Parameters<typeof buildLookupEvent>[0]["result"]
}

/** One row per lookup, tied to the request it came from when there is one. */
export function logLookups(lookups: readonly LookupLike[]): void {
  const { log } = usage()
  if (!log) return
  const request = currentRequest()
  const now = new Date()
  for (const { query, result } of lookups) {
    log.lookup(buildLookupEvent({ now, requestId: request?.id ?? null, surface: request?.surface ?? null, name: query.name, result }))
  }
}
