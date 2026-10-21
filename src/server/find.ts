// The one place the site, the REST API and the MCP tools get answers from.
// Response fields are snake_case because they go straight out as JSON.

import { rankCandidates, type Candidate } from "../lib/email/candidates"
import { normalizeDomain } from "../lib/email/domains"
import { parseName } from "../lib/email/names"
import { patternById } from "../lib/email/patterns"
import { priorFor, type Prior, type PriorBasis } from "../lib/email/priors"
import { getPatternMix, getStore } from "./db"
import { mailStatus, type MailStatus } from "./mx"
import type { DomainRecord } from "./store"
import { logLookups } from "./usage"

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
  /** What the ranking starts from before this company's own addresses: formats at companies on
   *  the same mail host, across all known companies, or the built-in defaults. */
  prior_basis: PriorBasis
  sample_count: number
  candidates: CandidateOut[]
  mail: { accepts_mail: boolean | null; host: string | null }
}

export const MAX_BATCH = 50

export interface DomainContext {
  record: DomainRecord | null
  mail: MailStatus
  prior: Prior
  basis: PriorBasis
}

/** Everything needed to rank formats for a domain: its own data, its mail host and the prior. */
export async function domainContext(domain: string): Promise<DomainContext> {
  const store = await getStore()
  const stored = store.getMailHost(domain)
  const [mail, mix] = await Promise.all([
    stored ? Promise.resolve({ acceptsMail: stored.acceptsMail, host: stored.host }) : mailStatus(domain),
    getPatternMix(),
  ])
  const { prior, basis } = priorFor(mix, mail.host)
  return { record: store.getDomain(domain), mail, prior, basis }
}

function out(c: Candidate): CandidateOut {
  return {
    email: c.email,
    pattern: c.patternId,
    template: `${c.template}@`,
    confidence: Math.round(c.confidence * 1000) / 1000,
  }
}

async function findOne(query: FindQuery, limit: number): Promise<FindResult> {
  const empty = {
    company_name: null,
    known_domain: false,
    prior_basis: "catalogue" as const,
    sample_count: 0,
    candidates: [],
    mail: { accepts_mail: null, host: null },
  }
  const domain = normalizeDomain(query.domain)
  if (!domain) return { query, domain: null, error: "invalid_domain", ...empty }

  const name = query.name?.trim() ? parseName(query.name) : null
  if (query.name?.trim() && !name) return { query, domain, error: "invalid_name", ...empty }

  const { record, mail, prior, basis } = await domainContext(domain)
  const candidates = rankCandidates(name, domain, record?.patterns ?? [], limit, prior).map(out)
  for (const c of candidates) c.template = `${patternById(c.pattern)!.template}@${domain}`

  return {
    query,
    domain,
    error: null,
    company_name: record?.companyName ?? null,
    known_domain: Boolean(record && record.sampleCount > 0),
    prior_basis: basis,
    sample_count: record?.sampleCount ?? 0,
    candidates,
    mail: { accepts_mail: mail.acceptsMail, host: mail.host },
  }
}

/** Answers a batch of lookups. Each query is independent; a bad one never fails the rest. */
export async function findEmails(queries: readonly FindQuery[], limit = 5): Promise<FindResult[]> {
  const asked = queries.slice(0, MAX_BATCH)
  const results = await Promise.all(asked.map((q) => findOne(q, limit)))
  logLookups(asked.map((query, i) => ({ query, result: results[i] })))
  return results
}
