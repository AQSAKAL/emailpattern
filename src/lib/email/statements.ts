// Reads free-text format statements such as "firstname.lastname@acme.com",
// "{first initial}{last name}@x.com or {first name}@x.com" or "name.surname" into
// catalogue patterns. Anything it can't read exactly (role inboxes like "info",
// "initials", vague notes) yields nothing rather than a guess.

import { normalizeDomain } from "./domains"
import { PATTERNS } from "./patterns"

// Longest spellings first, so "firstname" wins over "first" and "f".
const VOCABULARY: [string, string][] = [
  ["firstinitial", "{f}"], ["finitial", "{f}"], ["lastinitial", "{l}"], ["linitial", "{l}"],
  ["givenname", "{first}"], ["firstname", "{first}"], ["familyname", "{last}"], ["lastname", "{last}"],
  ["surname", "{last}"], ["vorname", "{first}"], ["nachname", "{last}"], ["prenom", "{first}"],
  ["nombre", "{first}"], ["apellido", "{last}"], ["fname", "{first}"], ["lname", "{last}"],
  ["first", "{first}"], ["last", "{last}"], ["name", "{first}"], ["fi", "{f}"],
  ["f", "{f}"], ["l", "{l}"],
]

const BY_TEMPLATE = new Map(PATTERNS.map((p) => [p.template, p.id]))

export interface StatedPattern {
  domain: string | null
  patternId: string
}

/** One local-part description ("first.last", "flastname") as a catalogue pattern id, or null. */
export function describedPattern(localPart: string): string | null {
  // Square brackets, slashes and parentheses mark placeholders or notes, not a format.
  if (/[[\]/()]/.test(localPart)) return null
  const text = localPart.toLowerCase().replace(/[{}<>\s]/g, "").replace(/_(?=name|initial)/g, "")
  let template = ""
  for (const piece of text.split(/([._-])/)) {
    if (/^[._-]$/.test(piece)) {
      template += piece
      continue
    }
    let rest = piece
    while (rest) {
      const hit = VOCABULARY.find(([word]) => rest.startsWith(word))
      if (!hit) return null
      template += hit[1]
      rest = rest.slice(hit[0].length)
    }
  }
  return BY_TEMPLATE.get(template) ?? null
}

/** Every pattern a statement names, each with the domain written next to it (or the fallback). */
export function parseStatement(statement: string, fallbackDomain: string | null): StatedPattern[] {
  const fallback = fallbackDomain ? normalizeDomain(fallbackDomain) : null
  const found: StatedPattern[] = []
  for (const alternative of statement.split(/\s+or\s+|[,;]\s*|\s+and\s+/i)) {
    const trimmed = alternative.trim()
    if (!trimmed) continue
    const at = trimmed.lastIndexOf("@")
    const local = at === -1 ? trimmed : trimmed.slice(0, at)
    const domain = at === -1 ? fallback : normalizeDomain(trimmed.slice(at + 1)) ?? fallback
    const patternId = describedPattern(local)
    if (patternId && !found.some((f) => f.patternId === patternId && f.domain === domain)) found.push({ domain, patternId })
  }
  return found
}
