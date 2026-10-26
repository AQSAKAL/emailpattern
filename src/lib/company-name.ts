// Registry and crawl data sometimes put an address or a long legal form where the company name
// should be. Titles and descriptions use the name only when it reads like one.

const MAX_LENGTH = 40

/** The company name fit to show next to its domain, or null to show the domain alone. */
export function displayCompanyName(name: string | null | undefined, domain: string): string | null {
  const trimmed = name?.trim()
  if (!trimmed || trimmed.length > MAX_LENGTH) return null
  if (/\d/.test(trimmed) && /,/.test(trimmed)) return null
  if (trimmed.toLowerCase() === domain.toLowerCase()) return null
  return trimmed
}

const MAX_INDUSTRY_LENGTH = 70

/**
 * Splits a registry "industry" into a short label and a description. Some registers (Sweden)
 * hold the articles' purpose clause there ("The company shall …"): that is a description,
 * not an industry.
 */
export function splitIndustry(text: string | null | undefined): { label: string | null; description: string | null } {
  const trimmed = text?.trim().replace(/\.+$/, "")
  if (!trimmed) return { label: null, description: null }
  const sentence = /\b(shall|will|is to|aims to|engage)\b/i.test(trimmed) || /[.;]\s/.test(trimmed)
  if (trimmed.length <= MAX_INDUSTRY_LENGTH && !sentence) return { label: trimmed, description: null }
  return { label: null, description: `${trimmed}.` }
}
