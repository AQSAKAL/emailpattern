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

// Legal forms people leave out when they search for a company, in the countries we cover.
const LEGAL_FORMS = [
  "aktiebolag", "aktiebolaget", "ab \\(publ\\)", "ab", "asa", "as", "a/s", "aps", "ivs", "k/s", "p/s", "oy", "oyj", "ab oy",
  "hf", "ehf", "oü", "aas", "uab", "sia", "s\\.r\\.o\\.", "spol\\. s r\\.o\\.", "a\\.s\\.", "sp\\. z o\\.o\\.", "s\\.a\\.", "sa",
  "gmbh & co\\. kg", "gmbh", "ag", "kg", "se", "plc", "ltd\\.?", "limited", "llc", "inc\\.?", "corp\\.?", "corporation",
  "co\\.", "b\\.v\\.", "bv", "n\\.v\\.", "nv", "sas", "sarl", "s\\.a\\.s\\.", "s\\.p\\.a\\.", "spa", "srl", "s\\.r\\.l\\.",
  "s\\.l\\.", "sl", "kft\\.?", "zrt\\.?", "nyrt\\.?", "d\\.o\\.o\\.", "d\\.d\\.", "ad", "eood", "ood",
  "sabiedrība ar ierobežotu atbildību", "akciju sabiedrība", "osaühing", "aktsiaselts",
].join("|")
const LEADING_FORM = new RegExp(`^(${LEGAL_FORMS})\\s+`, "i")
const TRAILING_FORM = new RegExp(`[\\s,]+(${LEGAL_FORMS})$`, "i")

/** Letters and digits only, lower case and without accents, for comparing names with domains. */
function compact(text: string): string {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * "NOVO NORDISK" reads "Novo Nordisk". Acronyms stay: words of three letters or fewer (NHS, DSV),
 * and a one-word name of four (IKEA, SAAB).
 */
function recase(name: string): string {
  if (name !== name.toUpperCase() || name === name.toLowerCase()) return name
  const keep = /\s/.test(name.trim()) ? 3 : 4
  return name.replace(/\p{L}+/gu, (word) => (word.length > keep ? word[0] + word.slice(1).toLowerCase() : word))
}

/**
 * The name people search for a company by, or null to use the domain. Legal forms are dropped and
 * all-caps names recased. A registry name counts only when it matches the domain (registers list
 * whoever gave the website, which is sometimes another company); a name we stored with the
 * company's own addresses is trusted.
 */
export function searchName(name: string | null | undefined, domain: string, trusted = false): string | null {
  let text = name?.trim().replace(/^["“]|["”]$/g, "").replace(/\s+/g, " ")
  if (!text) return null
  for (let i = 0; i < 3; i++) text = text.replace(LEADING_FORM, "").replace(TRAILING_FORM, "").replace(/^["“]|["”]$/g, "").trim()
  const shown = displayCompanyName(recase(text), domain)
  if (!shown || trusted) return shown
  const label = compact(domain.split(".")[0])
  const plain = compact(shown)
  if (label.length < 3 || plain.length < 3) return null
  const matches = (plain.startsWith(label) && label.length >= plain.length / 2) || (label.startsWith(plain) && plain.length >= label.length / 2)
  return matches ? shown : null
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
