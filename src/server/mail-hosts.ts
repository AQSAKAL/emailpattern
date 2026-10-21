import { normalizeDomain } from "../lib/email/domains"
import type { MailHost } from "./store"

/** One line of an MX lookup file, or null when it isn't usable. Pure. */
export function parseMailHostLine(line: string): MailHost | null {
  if (!line.trim()) return null
  let row: { domain?: unknown; accepts_mail?: unknown; host?: unknown }
  try {
    row = JSON.parse(line)
  } catch {
    return null
  }
  const domain = typeof row.domain === "string" ? normalizeDomain(row.domain) : null
  if (!domain) return null
  const acceptsMail = typeof row.accepts_mail === "boolean" ? row.accepts_mail : null
  const host = typeof row.host === "string" && row.host ? row.host : null
  return { domain, acceptsMail, host }
}
