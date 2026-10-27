import { describe, expect, it } from "vitest"
import { displayCompanyName, searchName, splitIndustry } from "../src/lib/company-name"

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

describe("searchName", () => {
  it("drops legal forms and recases all-caps names", () => {
    expect(searchName("Dynamant AB", "dynamant.se")).toBe("Dynamant")
    expect(searchName("BYÅSEN TREVARE AS", "byasentrevare.no")).toBe("Byåsen Trevare")
    expect(searchName("Linné Travel Service Aktiebolag", "linnetravel.se")).toBe("Linné Travel Service")
    expect(searchName("lambda9 GmbH", "lambda9.de")).toBe("lambda9")
    expect(searchName('Sabiedrība ar ierobežotu atbildību "ASILEKS"', "asileks.com")).toBe("Asileks")
    expect(searchName("IKEA", "ikea.com")).toBe("IKEA")
    expect(searchName("NOVO NORDISK A/S", "novonordisk.com")).toBe("Novo Nordisk")
    expect(searchName("APOTEK 1 GRUPPEN AS", "apotek1.no")).toBe("Apotek 1 Gruppen")
  })

  it("leaves out registry names that are another company's", () => {
    expect(searchName("Porin Talousneliöt Oy", "pori.fi")).toBeNull()
    expect(searchName("Peter Flygts Gräv & Transport Aktiebolag", "flygts.se")).toBeNull()
    expect(searchName("Remolino OÜ", "arteflamenco.ee")).toBeNull()
  })

  it("trusts names stored with the company's own addresses", () => {
    expect(searchName("Capgemini", "capgemini.com", true)).toBe("Capgemini")
    expect(searchName("LEO Pharma A/S", "leo-pharma.com", true)).toBe("LEO Pharma")
    expect(searchName(null, "nhs.net", true)).toBeNull()
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
