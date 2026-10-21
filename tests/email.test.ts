import { describe, expect, it } from "vitest"
import { rankCandidates, patternShares } from "../src/lib/email/candidates"
import { normalizeDomain } from "../src/lib/email/domains"
import { inferDomainPatterns, matchPatterns } from "../src/lib/email/infer"
import { mailHostName } from "../src/lib/email/mail-host"
import { parseName } from "../src/lib/email/names"
import { PATTERNS, applyTemplate, renameTokens, spreadsheetFormula, templateSegments } from "../src/lib/email/patterns"

describe("parseName", () => {
  it.each([
    ["Jane Doe", { first: "jane", last: "doe" }],
    ["Doe, Jane", { first: "jane", last: "doe" }],
    ["Dr. Jane M. Doe Jr.", { first: "jane", last: "doe" }],
    ["José María García", { first: "jose", last: "garcia" }],
    ["Søren Kierkegaard", { first: "soren", last: "kierkegaard" }],
    ["Jürgen Großmann", { first: "jurgen", last: "grossmann" }],
    ["Ludwig van Beethoven", { first: "ludwig", last: "vanbeethoven" }],
    ["Vincent van der Berg", { first: "vincent", last: "vanderberg" }],
    ["Conan O'Brien", { first: "conan", last: "obrien" }],
    ["Anna Smith-Jones", { first: "anna", last: "smith-jones" }],
    ["Madonna", { first: "madonna", last: null }],
  ])("%s", (raw, expected) => {
    expect(parseName(raw)).toEqual(expected)
  })

  it("rejects empty and punctuation-only input", () => {
    expect(parseName("   ")).toBeNull()
    expect(parseName("--")).toBeNull()
  })
})

describe("normalizeDomain", () => {
  it.each([
    ["acme.com", "acme.com"],
    ["  ACME.com ", "acme.com"],
    ["https://www.acme.co.uk/about?x=1", "acme.co.uk"],
    ["jane@acme.com", "acme.com"],
    ["acme.com.", "acme.com"],
    ["acme.com:8080", "acme.com"],
    ["bücher.de", "xn--bcher-kva.de"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected)
  })

  it.each(["", "acme", "acme.c0m", "-acme.com", "http://", "a b.com"])("rejects %j", (input) => {
    expect(normalizeDomain(input)).toBeNull()
  })
})

describe("applyTemplate", () => {
  const jane = { first: "jane", last: "doe" }
  it("fills every catalogue template", () => {
    const filled = Object.fromEntries(PATTERNS.map((p) => [p.id, applyTemplate(p.template, jane)]))
    expect(filled["first-dot-last"]).toBe("jane.doe")
    expect(filled.flast).toBe("jdoe")
    expect(filled["first-dot-l"]).toBe("jane.d")
    expect(filled.fl).toBe("jd")
  })

  it("returns null when the name lacks a part the template needs", () => {
    expect(applyTemplate("{first}.{last}", { first: "madonna", last: null })).toBeNull()
    expect(applyTemplate("{first}", { first: "madonna", last: null })).toBe("madonna")
  })

  it("splits templates for rendering", () => {
    expect(templateSegments("{f}.{last}")).toEqual([
      { kind: "token", value: "f" },
      { kind: "text", value: "." },
      { kind: "token", value: "last" },
    ])
  })
})

describe("rankCandidates", () => {
  const jane = { first: "jane", last: "doe" }

  it("follows the global prior when the domain is unknown", () => {
    const [top] = rankCandidates(jane, "acme.com", [])
    expect(top.email).toBe("jane.doe@acme.com")
  })

  it("lets a few observations outweigh the prior", () => {
    const ranked = rankCandidates(jane, "acme.com", [{ patternId: "flast", weight: 6 }])
    expect(ranked[0].email).toBe("jdoe@acme.com")
    expect(ranked[0].confidence).toBeGreaterThan(0.7)
  })

  it("returns confidences that sum to at most 1 and are sorted", () => {
    const ranked = rankCandidates(jane, "acme.com", [{ patternId: "first", weight: 3 }], 15)
    const total = ranked.reduce((s, c) => s + c.confidence, 0)
    expect(total).toBeCloseTo(1, 6)
    expect(ranked.map((c) => c.confidence)).toEqual([...ranked.map((c) => c.confidence)].sort((a, b) => b - a))
  })

  it("only offers single-name formats for a single name", () => {
    const ranked = rankCandidates({ first: "madonna", last: null }, "acme.com", [], 15)
    expect(ranked.map((c) => c.email)).toEqual(["madonna@acme.com"])
  })

  it("merges templates that produce the same address", () => {
    const ranked = rankCandidates({ first: "a", last: "b" }, "acme.com", [], 15)
    const emails = ranked.map((c) => c.email)
    expect(new Set(emails).size).toBe(emails.length)
  })

  it("ranks formats without a name", () => {
    const ranked = rankCandidates(null, "acme.com", [{ patternId: "last-dot-first", weight: 10 }])
    expect(ranked[0].patternId).toBe("last-dot-first")
    expect(ranked[0].email).toBeNull()
  })

  it("smooths shares towards the prior", () => {
    const shares = patternShares([])
    expect(shares.get("first-dot-last")).toBeCloseTo(0.32)
  })
})

describe("inferDomainPatterns", () => {
  it("matches a sample to the template that built it", () => {
    expect(matchPatterns({ name: "Jane Doe", email: "J.Doe@acme.com" }, "acme.com")).toEqual(["f-dot-last"])
    expect(matchPatterns({ name: "Jane Doe", email: "jane.doe+news@acme.com" }, "acme.com")).toEqual(["first-dot-last"])
  })

  it("ignores role inboxes and other domains", () => {
    expect(matchPatterns({ name: "Jane Doe", email: "info@acme.com" }, "acme.com")).toEqual([])
    expect(matchPatterns({ name: "Jane Doe", email: "jane.doe@other.com" }, "acme.com")).toEqual([])
  })

  it("splits ambiguous samples and counts the unmatched", () => {
    const result = inferDomainPatterns("acme.com", [
      { name: "Jane Doe", email: "jane.doe@acme.com" },
      { name: "John Smith", email: "john.smith@acme.com" },
      { name: "Al B", email: "alb@acme.com" }, // firstl and firstlast both give "alb"
      { name: "Bob Ray", email: "bobby@acme.com" },
    ])
    expect(result.matched).toBe(3)
    expect(result.unmatched).toBe(1)
    expect(result.patterns[0]).toEqual({ patternId: "first-dot-last", weight: 2 })
    expect(result.patterns.find((p) => p.patternId === "firstl")?.weight).toBeCloseTo(0.5)
  })
})

describe("mailHostName", () => {
  it("recognises common hosts", () => {
    expect(mailHostName(["aspmx.l.google.com"])).toBe("Google Workspace")
    expect(mailHostName(["acme-com.mail.protection.outlook.com."])).toBe("Microsoft 365")
    expect(mailHostName(["mx.acme.com"])).toBeNull()
  })
})

describe("spreadsheetFormula", () => {
  it("builds the address from columns A, B and C", () => {
    expect(spreadsheetFormula("{first}.{last}")).toBe('=LOWER(A2&"."&B2&"@"&C2)')
    expect(spreadsheetFormula("{f}{last}")).toBe('=LOWER(LEFT(A2,1)&B2&"@"&C2)')
  })
})

describe("renameTokens", () => {
  it("writes token names in the page's language", () => {
    expect(renameTokens("{f}.{last}", { first: "prenom", last: "nom", f: "p", l: "n" })).toBe("{p}.{nom}")
  })
})
