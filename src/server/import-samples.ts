import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { normalizeDomain } from "../lib/email/domains"
import { inferDomainPatterns, type Sample } from "../lib/email/infer"
import type { Store } from "./store"

interface SampleLine extends Sample {
  company?: string
}

/**
 * Reads JSON Lines of {name, email, company?}, learns each domain's formats and
 * writes them to the store. Only pattern weights are kept, never the addresses.
 */
export async function importSamples(store: Store, path: string): Promise<{ domains: number; samples: number }> {
  const byDomain = new Map<string, { company: string | null; samples: Sample[] }>()
  let samples = 0

  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  for await (const line of lines) {
    if (!line.trim()) continue
    const sample = JSON.parse(line) as SampleLine
    const domain = normalizeDomain(sample.email)
    if (!domain) continue
    samples++
    const entry = byDomain.get(domain) ?? { company: null, samples: [] }
    entry.company ??= sample.company ?? null
    entry.samples.push({ name: sample.name, email: sample.email })
    byDomain.set(domain, entry)
  }

  const updatedAt = new Date().toISOString()
  let domains = 0
  for (const [domain, entry] of byDomain) {
    const inference = inferDomainPatterns(domain, entry.samples)
    if (inference.matched === 0) continue
    store.upsertDomain({
      domain,
      companyName: entry.company,
      sampleCount: inference.matched,
      patterns: inference.patterns,
      updatedAt,
    })
    domains++
  }
  return { domains, samples }
}
