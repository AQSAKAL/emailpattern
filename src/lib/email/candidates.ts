import { PATTERNS, applyTemplate, patternById, type NameParts } from "./patterns"
import { CATALOGUE_PRIOR, type Prior } from "./priors"

/** How many people at a domain were seen using a pattern (fractional when ambiguous). */
export interface PatternWeight {
  patternId: string
  weight: number
}

export interface Candidate {
  patternId: string
  template: string
  email: string | null
  /** 0..1, the share of the domain's people expected to use this pattern. */
  confidence: number
}

// How many observations the prior is worth. Low, so a handful of real samples from a
// domain outweighs the guess.
const PRIOR_STRENGTH = 2

/** Pattern shares for a domain: observations smoothed towards a prior (see priors.ts). */
export function patternShares(observed: readonly PatternWeight[], prior: Prior = CATALOGUE_PRIOR): Map<string, number> {
  const seen = new Map(observed.map((o) => [o.patternId, o.weight]))
  const total = observed.reduce((sum, o) => sum + o.weight, 0)
  return new Map(
    PATTERNS.map((p) => [p.id, ((seen.get(p.id) ?? 0) + PRIOR_STRENGTH * (prior.get(p.id) ?? 0)) / (total + PRIOR_STRENGTH)]),
  )
}

/**
 * The most likely addresses for a person at a domain, best first.
 * Without a name it ranks the formats themselves (email stays null).
 */
export function rankCandidates(
  name: NameParts | null,
  domain: string,
  observed: readonly PatternWeight[],
  limit = 5,
  prior: Prior = CATALOGUE_PRIOR,
): Candidate[] {
  const shares = patternShares(observed, prior)
  const byEmail = new Map<string, Candidate>()
  const formats: Candidate[] = []

  for (const [patternId, share] of shares) {
    const pattern = patternById(patternId)!
    if (!name) {
      formats.push({ patternId, template: pattern.template, email: null, confidence: share })
      continue
    }
    const local = applyTemplate(pattern.template, name)
    if (!local) continue
    const email = `${local}@${domain}`
    // Two templates can produce the same address ("first" and "firstl" for a one-letter
    // surname); the address is as likely as both together.
    const existing = byEmail.get(email)
    if (existing) existing.confidence += share
    else byEmail.set(email, { patternId, template: pattern.template, email, confidence: share })
  }

  const ranked = name ? [...byEmail.values()] : formats
  const sum = ranked.reduce((s, c) => s + c.confidence, 0) || 1
  return ranked
    .map((c) => ({ ...c, confidence: c.confidence / sum }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit)
}

/** Below this share the top format is only the most common one, not what most people use. */
export const MAJORITY_SHARE = 0.5

/** Whether a domain's evidence is split, so pages should not state its top format as the rule. */
export function isMixedEvidence(topShare: number): boolean {
  return topShare < MAJORITY_SHARE
}
