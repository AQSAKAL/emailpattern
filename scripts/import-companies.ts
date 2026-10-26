// Loads registry facts about the companies behind each domain, replacing earlier ones.
//   npm run -s import-companies -- companies.jsonl
// Lines: {domain, rank, name, country, founded_year, industry, legal_form, employees,
//         employees_exact, revenue, currency, financial_year}; rank 1 is the main company.
import { resolve } from "node:path"
import { importCompanies } from "../src/server/import-companies"
import { openStore } from "../src/server/store"

const file = process.argv[2]
if (!file) {
  console.error("usage: npm run -s import-companies -- <companies.jsonl>")
  process.exit(1)
}
const store = openStore(resolve(process.env.DATA_DIR ?? "data", "emailpattern.sqlite"))
const counts = await importCompanies(store, resolve(file))
store.close()
console.log(`${counts.lines} lines → ${counts.companies} companies on ${counts.domains} domains`)
