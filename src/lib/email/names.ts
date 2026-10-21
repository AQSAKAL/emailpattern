import type { NameParts } from "./patterns"

const TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "sir", "dame", "herr", "frau", "mme", "mlle"])
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "phd", "md", "mba", "esq"])
// Surname particles that belong to the last name: "Ludwig van Beethoven" → vanbeethoven.
const PARTICLES = new Set([
  "van", "von", "der", "den", "de", "da", "di", "du", "del", "della", "des", "la", "le", "ter", "ten", "af", "al", "bin", "ibn", "st",
])

// Letters that Unicode decomposition does not reduce to ASCII.
const TRANSLITERATIONS: Record<string, string> = {
  ß: "ss", æ: "ae", ø: "o", œ: "oe", ł: "l", đ: "d", ð: "d", þ: "th", ı: "i",
}

/** Lowercase ASCII form of one name token; keeps hyphens, drops everything else. */
export function asciiToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[ßæøœłđðþı]/g, (ch) => TRANSLITERATIONS[ch] ?? ch)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
}

/**
 * Reads a person's name the way companies build addresses from it.
 * Accepts "Jane Doe", "Doe, Jane", "Dr. Jane M. Doe Jr." and single names.
 */
export function parseName(raw: string): NameParts | null {
  const reordered = raw.includes(",")
    ? raw.split(",").slice(0, 2).reverse().join(" ")
    : raw
  const words = reordered
    .split(/\s+/)
    .map((w) => w.replace(/\.$/, ""))
    .filter((w) => w && !TITLES.has(w.toLowerCase()) && !SUFFIXES.has(w.toLowerCase()))

  if (words.length === 0) return null
  const first = asciiToken(words[0])
  if (!first) return null
  if (words.length === 1) return { first, last: null }

  // Walk back from the end to collect particles in front of the surname.
  let start = words.length - 1
  while (start > 1 && PARTICLES.has(words[start - 1].toLowerCase())) start--
  const last = words.slice(start).map(asciiToken).join("")
  return { first, last: last || null }
}
