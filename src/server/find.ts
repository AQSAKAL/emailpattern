// The one place the site, the REST API and the MCP tools get answers from.
// Response fields are snake_case because they go straight out as JSON.

import { rankCandidates, type Candidate } from "../lib/email/candidates"
import { normalizeDomain } from "../lib/email/domains"
import { parseName } from "../lib/email/names"
import { patternById } from "../lib/email/patterns"
import { getStore } from "./db"
import { mailStatus } from "./mx"

export interface FindQuery {
  domain: string
  name?: string
}

export interface CandidateOut {
  email: string | null
  pattern: string
  template: string
  confidence: number
}

export interface FindResult {
  query: FindQuery
  domain: string | null
  error: "invalid_domain" | "invalid_name" | null
  company_name: string | null
  /** True when the formats come from people seen at this domain, false when they are the global defaults. */
  known_domain: boolean
  sample_count: number
  candidates: CandidateOut[]
  mail: { accepts_mail: boolean | null; host: string | null }
}

export const MAX_BATCH = 50

function out(c: Candidate): CandidateOut {
  return {
    email: c.email,
    pattern: c.patternId,
    template: `${c.template}@`,
    confidence: Math.round(c.confidence * 1000) / 1000,
  }
}

async function findOne(query: FindQuery, limit: number): Promise<FindResult> {
  const empty = { company_name: null, known_domain: false, sample_count: 0, candidates: [], mail: { accepts_mail: null, host: null } }
  const domain = normalizeDomain(query.domain)
  if (!domain) return { query, domain: null, error: "invalid_domain", ...empty }

  const name = query.name?.trim() ? parseName(query.name) : null
  if (query.name?.trim() && !name) return { query, domain, error: "invalid_name", ...empty }

  const store = await getStore()
  const [record, mail] = await Promise.all([Promise.resolve(store.getDomain(domain)), mailStatus(domain)])
  const candidates = rankCandidates(name, domain, record?.patterns ?? [], limit).map(out)
  for (const c of candidates) c.template = `${patternById(c.pattern)!.template}@${domain}`

  return {
    query,
    domain,
    error: null,
    company_name: record?.companyName ?? null,
    known_domain: Boolean(record && record.sampleCount > 0),
    sample_count: record?.sampleCount ?? 0,
    candidates,
    mail: { accepts_mail: mail.acceptsMail, host: mail.host },
  }
}

/** Answers a batch of lookups. Each query is independent; a bad one never fails the rest. */
export async function findEmails(queries: readonly FindQuery[], limit = 5): Promise<FindResult[]> {
  return Promise.all(queries.slice(0, MAX_BATCH).map((q) => findOne(q, limit)))
}
