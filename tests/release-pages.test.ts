import { describe, expect, it } from "vitest"
import { pickRelease } from "../src/server/release-pages"
import { urlSet } from "../src/server/sitemap"

describe("pickRelease", () => {
  it("takes companies whose name matches the domain, never mailbox providers, up to the count", () => {
    const candidates = [
      { domain: "gmail.com", name: "Gmail AB", employees: 9000 },
      { domain: "pori.fi", name: "Porin Talousneliöt Oy", employees: 800 },
      { domain: "dynamant.se", name: "Dynamant AB", employees: 50 },
      { domain: "enkon.se", name: "Enkon AB", employees: 20 },
      { domain: "lambda9.de", name: "lambda9 GmbH", employees: 10 },
    ]
    expect(pickRelease(candidates, 2)).toEqual(["dynamant.se", "enkon.se"])
  })
})

describe("urlSet", () => {
  it("leaves out language alternates for single-language pages", () => {
    expect(urlSet("https://x.com", "en", ["/a.com"], false)).toContain("<url><loc>https://x.com/a.com</loc></url>")
    expect(urlSet("https://x.com", "en", ["/a.com"])).toContain('hreflang="de"')
  })
})
