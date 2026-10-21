import type { PatternWeight } from "./candidates"
import { parseName } from "./names"
import { PATTERNS, applyTemplate } from "./patterns"

export interface Sample {
  name: string
  email: string
}

// Shared inboxes say nothing about how a company names its people.
const ROLE_ADDRESSES = new Set([
  "info", "sales", "contact", "hello", "hi", "support", "help", "admin", "office", "post", "mail", "kontakt",
  "team", "jobs", "careers", "press", "media", "billing", "accounts", "invoice", "hr", "noreply", "no-reply",
  "marketing", "service", "enquiries", "inquiries", "reception",
])

/** Ids of every pattern that turns the sample's name into its address at this domain. */
export function matchPatterns(sample: Sample, domain: string): string[] {
  const at = sample.email.lastIndexOf("@")
  if (at < 1) return []
  const local = sample.email.slice(0, at).toLowerCase().split("+")[0]
  const host = sample.email.slice(at + 1).toLowerCase()
  if (host !== domain || ROLE_ADDRESSES.has(local)) return []

  const name = parseName(sample.name)
  if (!name) return []
  return PATTERNS.filter((p) => applyTemplate(p.template, name) === local).map((p) => p.id)
}

export interface Inference {
  patterns: PatternWeight[]
  /** Samples that matched at least one pattern. */
  matched: number
  /** Samples that matched none (role inboxes, nicknames, formats not in the catalogue). */
  unmatched: number
}

/**
 * Learns a domain's formats from known name/address pairs. A sample that fits several
 * patterns (a one-letter first name, say) splits its weight between them.
 */
export function inferDomainPatterns(domain: string, samples: readonly Sample[]): Inference {
  const weights = new Map<string, number>()
  let matched = 0
  for (const sample of samples) {
    const ids = matchPatterns(sample, domain)
    if (ids.length === 0) continue
    matched++
    for (const id of ids) weights.set(id, (weights.get(id) ?? 0) + 1 / ids.length)
  }
  const patterns = [...weights]
    .map(([patternId, weight]) => ({ patternId, weight }))
    .sort((a, b) => b.weight - a.weight)
  return { patterns, matched, unmatched: samples.length - matched }
}
