// Kept apart from the dictionaries so client islands can import it without them.

/** Fills {placeholders} in a dictionary string. Unknown placeholders are left as they are. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}

/**
 * Splits a string at its remaining {placeholders} so a page can put markup there:
 * "Use {template}." → ["Use ", { key: "template" }, "."]
 */
export function splitPlaceholders(text: string): (string | { key: string })[] {
  return text
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((part) => (/^\{\w+\}$/.test(part) ? { key: part.slice(1, -1) } : part))
}
