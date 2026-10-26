import { describe, expect, it } from "vitest"
import { displayCompanyName, splitIndustry } from "../src/lib/company-name"

describe("displayCompanyName", () => {
  it("keeps a real name", () => {
    expect(displayCompanyName("Tobii AB", "tobii.com")).toBe("Tobii AB")
  })

  it("drops addresses, long legal names, blanks and the bare domain", () => {
    expect(displayCompanyName("Tallinn, A. Reinvaldi tn 3 korter 5", "1partner.ee")).toBeNull()
    expect(displayCompanyName("Sabiedrība ar ierobežotu atbildību Windows Factory Latvia", "windowsfactory.lv")).toBeNull()
    expect(displayCompanyName("  ", "x.com")).toBeNull()
    expect(displayCompanyName(null, "x.com")).toBeNull()
    expect(displayCompanyName("acme.co", "acme.co")).toBeNull()
  })
})

describe("splitIndustry", () => {
  it("keeps a short label", () => {
    expect(splitIndustry("Security services")).toEqual({ label: "Security services", description: null })
  })

  it("turns a purpose clause into a description", () => {
    const clause = "The company shall conduct research, development, and sales of computer software."
    expect(splitIndustry(clause)).toEqual({ label: null, description: clause })
  })

  it("drops a doubled full stop and handles blanks", () => {
    expect(splitIndustry("The company shall trade in goods..").description).toBe("The company shall trade in goods.")
    expect(splitIndustry("  ")).toEqual({ label: null, description: null })
  })
})
