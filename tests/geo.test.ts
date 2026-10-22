import { describe, expect, it } from "vitest"
import { geoFields, geoUrls } from "../src/lib/geo"

describe("geoUrls", () => {
  it("asks for this month's file, then last month's", () => {
    expect(geoUrls("country", new Date("2026-01-03T00:00:00Z"))).toEqual([
      "https://download.db-ip.com/free/dbip-country-lite-2026-01.mmdb.gz",
      "https://download.db-ip.com/free/dbip-country-lite-2025-12.mmdb.gz",
    ])
  })
})

describe("geoFields", () => {
  it("keeps the country code and network", () => {
    const country = { country: { iso_code: "FI", names: { en: "Finland" } } }
    const asn = { autonomous_system_number: 24940, autonomous_system_organization: "Hetzner Online GmbH" }
    expect(geoFields(country, asn)).toEqual({ country: "FI", asn: 24940, as_org: "Hetzner Online GmbH" })
  })

  it("falls back to the registered country and copes with no records", () => {
    expect(geoFields({ registered_country: { iso_code: "US" } }, null).country).toBe("US")
    expect(geoFields(null, null)).toEqual({ country: null, asn: null, as_org: null })
  })
})
