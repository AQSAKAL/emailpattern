import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { normalizeDomain } from "../lib/email/domains"
import type { CompanyFact, Store } from "./store"

/** One line of a company-facts file, as exported from registry data (snake_case). */
export interface CompanyLine {
  domain: string
  rank: number
  name: string
  country: string
  founded_year?: number | null
  industry?: string | null
  legal_form?: string | null
  employees?: number | null
  employees_exact?: boolean | number | null
  revenue?: number | null
  currency?: string | null
  financial_year?: number | null
}

/** A file line as a store row, or null when the domain or name is unusable. Pure. */
export function toCompanyFact(line: CompanyLine): CompanyFact | null {
  const domain = normalizeDomain(line.domain ?? "")
  const name = line.name?.trim()
  if (!domain || !name || !line.country) return null
  const positive = (n: number | null | undefined) => (typeof n === "number" && n > 0 ? n : null)
  const year = (n: number | null | undefined) => (typeof n === "number" && n >= 1600 && n <= 2100 ? n : null)
  return {
    domain,
    rank: Number(line.rank) || 1,
    name,
    country: line.country.toUpperCase(),
    foundedYear: year(line.founded_year),
    industry: line.industry?.trim() || null,
    legalForm: line.legal_form?.trim() || null,
    employees: positive(line.employees),
    employeesExact: Boolean(line.employees_exact),
    revenue: typeof line.revenue === "number" && Number.isFinite(line.revenue) ? line.revenue : null,
    currency: line.currency?.trim() || null,
    financialYear: year(line.financial_year),
  }
}

/** Loads company facts from JSON Lines, replacing what the store had. */
export async function importCompanies(store: Store, path: string): Promise<{ lines: number; companies: number; domains: number }> {
  const facts: CompanyFact[] = []
  let lines = 0
  for await (const line of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) {
    if (!line.trim()) continue
    lines++
    const fact = toCompanyFact(JSON.parse(line) as CompanyLine)
    if (fact) facts.push(fact)
  }
  const companies = store.replaceCompanies(facts)
  return { lines, companies, domains: new Set(facts.map((f) => f.domain)).size }
}
