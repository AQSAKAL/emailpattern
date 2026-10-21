// What to expect at a company before we have seen any of its addresses: the catalogue's
// starting guesses, sharpened by the formats measured across known companies, overall and
// among companies on the same mail host. Pure; the store supplies the measured mix.

import { PATTERNS } from "./patterns"

export type Prior = ReadonlyMap<string, number>

/** The catalogue's hand-set guesses; used until enough companies are known. */
export const CATALOGUE_PRIOR: Prior = new Map(PATTERNS.map((p) => [p.id, p.prior]))

/** Measured format shares among a group of companies, each company counting once. */
export interface MeasuredMix {
  /** Sum over companies of each format's share at that company. */
  shares: ReadonlyMap<string, number>
  domains: number
}

export interface PatternMix {
  overall: MeasuredMix
  byHost: ReadonlyMap<string, MeasuredMix>
}

export type PriorBasis = "mail_host" | "overall" | "catalogue"

/** Companies a measured mix needs before it fully replaces the guess underneath it. */
export const FULL_TRUST_DOMAINS = 200
/** Fewest companies on one mail host before that host gets its own mix. */
export const MIN_HOST_DOMAINS = 30

/**
 * The measured mix laid over a base prior, trusted in proportion to how many companies it
 * rests on. Every catalogue format keeps a little weight, so nothing is ever ruled out.
 */
export function blend(measured: MeasuredMix, base: Prior): Prior {
  const trust = Math.min(1, measured.domains / FULL_TRUST_DOMAINS)
  const total = [...measured.shares.values()].reduce((a, b) => a + b, 0)
  const blended = PATTERNS.map((p) => {
    const share = total > 0 ? (measured.shares.get(p.id) ?? 0) / total : 0
    const guess = base.get(p.id) ?? 0
    return [p.id, trust * share + (1 - trust) * guess + 0.001 * guess] as const
  })
  const sum = blended.reduce((a, [, v]) => a + v, 0) || 1
  return new Map(blended.map(([id, v]) => [id, v / sum]))
}

/** The prior for a company on `host` (null when unknown), and what it is based on. */
export function priorFor(mix: PatternMix | null, host: string | null): { prior: Prior; basis: PriorBasis } {
  if (!mix || mix.overall.domains === 0) return { prior: CATALOGUE_PRIOR, basis: "catalogue" }
  const overall = blend(mix.overall, CATALOGUE_PRIOR)
  const forHost = host ? mix.byHost.get(host) : undefined
  if (forHost && forHost.domains >= MIN_HOST_DOMAINS) return { prior: blend(forHost, overall), basis: "mail_host" }
  return { prior: overall, basis: "overall" }
}
