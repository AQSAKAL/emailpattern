import { describe, expect, it } from "vitest"
import { toCompanyFact } from "../src/server/import-companies"

describe("toCompanyFact", () => {
  it("cleans a registry line", () => {
    expect(
      toCompanyFact({
        domain: "WWW.Tobii.com", rank: 1, name: " Tobii AB ", country: "se", founded_year: 2001, industry: "Software",
        legal_form: "public limited company", employees: 212, employees_exact: true, revenue: 1.2e9, currency: "SEK", financial_year: 2024,
      }),
    ).toEqual({
      domain: "tobii.com", rank: 1, name: "Tobii AB", country: "SE", foundedYear: 2001, industry: "Software",
      legalForm: "public limited company", employees: 212, employeesExact: true, revenue: 1.2e9, currency: "SEK", financialYear: 2024,
    })
  })

  it("drops zero employees, impossible years and empty text", () => {
    const fact = toCompanyFact({ domain: "x.com", rank: 2, name: "X", country: "DE", founded_year: 0, employees: 0, industry: " ", financial_year: 99999 })
    expect(fact).toMatchObject({ foundedYear: null, employees: null, industry: null, financialYear: null, rank: 2 })
  })

  it("refuses lines without a usable domain or name", () => {
    expect(toCompanyFact({ domain: "nope", rank: 1, name: "X", country: "DE" })).toBeNull()
    expect(toCompanyFact({ domain: "x.com", rank: 1, name: " ", country: "DE" })).toBeNull()
  })
})
