// The catalogue of address formats. Data only: everything else derives from it.

export type Token = "first" | "last" | "f" | "l"

export interface Pattern {
  /** Stable id, also the URL slug of the pattern page. */
  id: string
  /** Local part with tokens in braces, e.g. "{first}.{last}". */
  template: string
  /**
   * Starting weight used when a domain has no observations yet.
   * Rough guesses until the store has enough domains to measure real shares.
   */
  prior: number
}

export const PATTERNS: readonly Pattern[] = [
  { id: "first-dot-last", template: "{first}.{last}", prior: 0.32 },
  { id: "first", template: "{first}", prior: 0.14 },
  { id: "flast", template: "{f}{last}", prior: 0.14 },
  { id: "firstlast", template: "{first}{last}", prior: 0.07 },
  { id: "f-dot-last", template: "{f}.{last}", prior: 0.05 },
  { id: "first-underscore-last", template: "{first}_{last}", prior: 0.04 },
  { id: "firstl", template: "{first}{l}", prior: 0.04 },
  { id: "last", template: "{last}", prior: 0.03 },
  { id: "last-dot-first", template: "{last}.{first}", prior: 0.03 },
  { id: "lastf", template: "{last}{f}", prior: 0.03 },
  { id: "first-hyphen-last", template: "{first}-{last}", prior: 0.02 },
  { id: "first-dot-l", template: "{first}.{l}", prior: 0.02 },
  { id: "lastfirst", template: "{last}{first}", prior: 0.02 },
  { id: "last-underscore-first", template: "{last}_{first}", prior: 0.01 },
  { id: "fl", template: "{f}{l}", prior: 0.01 },
]

const BY_ID = new Map(PATTERNS.map((p) => [p.id, p]))

export function patternById(id: string): Pattern | undefined {
  return BY_ID.get(id)
}

export interface NameParts {
  first: string
  last: string | null
}

/** Fills a template from name parts; null when the template needs a part the name lacks. */
export function applyTemplate(template: string, name: NameParts): string | null {
  const values: Record<Token, string | null> = {
    first: name.first,
    last: name.last,
    f: name.first.slice(0, 1),
    l: name.last ? name.last.slice(0, 1) : null,
  }
  let missing = false
  const filled = template.replace(/\{(first|last|f|l)\}/g, (_, token: Token) => {
    const value = values[token]
    if (!value) missing = true
    return value ?? ""
  })
  return missing ? null : filled
}

/** Splits a template into literal and token segments, for rendering. */
export function templateSegments(template: string): { kind: "token" | "text"; value: string }[] {
  return template
    .split(/(\{(?:first|last|f|l)\})/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("{") ? { kind: "token", value: part.slice(1, -1) } : { kind: "text", value: part },
    )
}

/**
 * A spreadsheet formula that builds the address from first name (A2), last name (B2)
 * and domain (C2). Assumes names are already plain ASCII.
 */
export function spreadsheetFormula(template: string): string {
  const cells: Record<string, string> = { first: "A2", last: "B2", f: "LEFT(A2,1)", l: "LEFT(B2,1)" }
  const parts = templateSegments(template).map((s) => (s.kind === "token" ? cells[s.value] : `"${s.value}"`))
  return `=LOWER(${[...parts, '"@"', "C2"].join("&")})`
}

/** The template with token names in another language: "{first}.{last}" → "{prenom}.{nom}". */
export function renameTokens(template: string, labels: Record<Token, string>): string {
  return template.replace(/\{(first|last|f|l)\}/g, (_, token: Token) => `{${labels[token]}}`)
}
