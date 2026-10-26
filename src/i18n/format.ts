// Number formatting shared by server views and client islands (no dictionaries imported).

/** "42 %" in the page's language; shares that round to zero read "<1 %" rather than "0 %". */
export function formatShare(lang: string, share: number): string {
  const percent = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 0 })
  return share > 0 && share < 0.005 ? `<${percent.format(0.01)}` : percent.format(share)
}

/** "SEK 1.2B" / "1,2 Mrd. SEK": revenue in its own currency, short. Null when unusable. */
export function formatMoney(lang: string, amount: number | null, currency: string | null): string | null {
  if (amount === null || !Number.isFinite(amount) || !currency) return null
  try {
    return new Intl.NumberFormat(lang, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(amount)
  } catch {
    return null
  }
}

/** A country's name in the page's language ("SE" → "Sweden", "Schweden"). */
export function countryName(lang: string, code: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}
