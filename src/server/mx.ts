import { promises as dns } from "node:dns"
import { mailHostName } from "../lib/email/mail-host"

export interface MailStatus {
  /** null when the lookup failed or timed out. */
  acceptsMail: boolean | null
  host: string | null
}

const TTL_MS = 6 * 60 * 60 * 1000
const MAX_ENTRIES = 50_000
const TIMEOUT_MS = 2500
const cache = new Map<string, { status: MailStatus; at: number }>()

async function lookup(domain: string): Promise<MailStatus> {
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
    ])
    const hosts = records.sort((a, b) => a.priority - b.priority).map((r) => r.exchange)
    // A single "." exchange is the null MX: the domain says it takes no mail.
    const accepts = hosts.some((h) => h && h !== ".")
    return { acceptsMail: accepts, host: accepts ? mailHostName(hosts) : null }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENOTFOUND" || code === "ENODATA") return { acceptsMail: false, host: null }
    return { acceptsMail: null, host: null }
  }
}

/** Whether a domain receives email, and who runs it. Cached for a few hours. */
export async function mailStatus(domain: string): Promise<MailStatus> {
  const hit = cache.get(domain)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.status
  const status = await lookup(domain)
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!)
  cache.set(domain, { status, at: Date.now() })
  return status
}
