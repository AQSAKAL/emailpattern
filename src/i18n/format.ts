// Number formatting shared by server views and client islands (no dictionaries imported).

/** "42 %" in the page's language; shares that round to zero read "<1 %" rather than "0 %". */
export function formatShare(lang: string, share: number): string {
  const percent = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 0 })
  return share > 0 && share < 0.005 ? `<${percent.format(0.01)}` : percent.format(share)
}
