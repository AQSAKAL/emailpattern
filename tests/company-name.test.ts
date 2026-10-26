import { describe, expect, it } from "vitest"
import { displayCompanyName } from "../src/lib/company-name"

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
