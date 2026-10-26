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
