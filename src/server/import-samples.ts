import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { normalizeDomain } from "../lib/email/domains"
import { isFreeMail } from "../lib/email/free-mail"
import { inferDomainPatterns, type Sample } from "../lib/email/infer"
import { parseStatement } from "../lib/email/statements"
import type { Store } from "./store"

/**
 * One line of an import file: either a person and their published address, or a
 * statement of a company's format ("firstname.lastname@acme.com") with how many
 * published addresses it rests on.
 */
export type ImportLine =
  | { name: string; email: string; company?: string }
  | { statement: string; domain?: string; company?: string; weight?: number }

interface DomainEvidence {
  company: string | null
  samples: Map<string, Sample>
  stated: Map<string, number>
}

export interface ImportCounts {
  lines: number
  samples: number
  statements: number
  skippedFreeMail: number
  domains: number
}

/** Folds import lines into per-domain evidence. Pure; repeated addresses count once. */
export function collectEvidence(lines: Iterable<ImportLine>): { byDomain: Map<string, DomainEvidence>; counts: Omit<ImportCounts, "domains"> } {
  const byDomain = new Map<string, DomainEvidence>()
  const counts = { lines: 0, samples: 0, statements: 0, skippedFreeMail: 0 }
  const entry = (domain: string, company?: string) => {
    const found = byDomain.get(domain) ?? { company: null, samples: new Map(), stated: new Map() }
    found.company ??= company?.trim() || null
    byDomain.set(domain, found)
    return found
  }

  for (const line of lines) {
    counts.lines++
    if ("statement" in line) {
      const stated = parseStatement(line.statement, line.domain ?? null)
      const share = Math.max(1, Math.min(5, line.weight ?? 1)) / Math.max(1, stated.length)
      for (const { domain, patternId } of stated) {
        if (!domain) continue
        if (isFreeMail(domain)) {
          counts.skippedFreeMail++
          continue
        }
        const evidence = entry(domain, line.company).stated
        evidence.set(patternId, (evidence.get(patternId) ?? 0) + share)
        counts.statements++
      }
      continue
    }
    const domain = normalizeDomain(line.email)
    if (!domain) continue
    if (isFreeMail(domain)) {
      counts.skippedFreeMail++
      continue
    }
    entry(domain, line.company).samples.set(line.email.trim().toLowerCase(), { name: line.name, email: line.email })
    counts.samples++
  }
  return { byDomain, counts }
}

/** Pattern weights and evidence count for one domain: matched people plus stated formats. */
export function domainWeights(domain: string, evidence: DomainEvidence) {
  const inference = inferDomainPatterns(domain, [...evidence.samples.values()])
  const weights = new Map(inference.patterns.map((p) => [p.patternId, p.weight]))
  for (const [patternId, weight] of evidence.stated) weights.set(patternId, (weights.get(patternId) ?? 0) + weight)
  const patterns = [...weights].map(([patternId, weight]) => ({ patternId, weight })).sort((a, b) => b.weight - a.weight)
  const stated = [...evidence.stated.values()].reduce((a, b) => a + b, 0)
  return { patterns, sampleCount: inference.matched + Math.round(stated) }
}

async function* readLines(path: string): AsyncGenerator<ImportLine> {
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  for await (const line of lines) if (line.trim()) yield JSON.parse(line) as ImportLine
}

/**
 * Reads JSON Lines of people with published addresses and/or format statements, learns each
 * domain's formats and writes them to the store. Only pattern weights are kept, never names
 * or addresses.
 */
export async function importSamples(store: Store, path: string): Promise<ImportCounts> {
  const all: ImportLine[] = []
  for await (const line of readLines(path)) all.push(line)
  const { byDomain, counts } = collectEvidence(all)

  const updatedAt = new Date().toISOString()
  let domains = 0
  for (const [domain, evidence] of byDomain) {
    const { patterns, sampleCount } = domainWeights(domain, evidence)
    if (patterns.length === 0) continue
    store.upsertDomain({ domain, companyName: evidence.company, sampleCount, patterns, updatedAt })
    domains++
  }
  return { ...counts, domains }
}
