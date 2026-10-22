import { describe, expect, it } from "vitest"
import { isFreeMail } from "../src/lib/email/free-mail"
import { describedPattern, parseStatement } from "../src/lib/email/statements"
import { collectEvidence, domainWeights, mergeWeights } from "../src/server/import-samples"
import { parseMailHostLine } from "../src/server/mail-hosts"

describe("describedPattern", () => {
  it.each([
    ["firstname.lastname", "first-dot-last"],
    ["first.last", "first-dot-last"],
    ["name.surname", "first-dot-last"],
    ["{first name}.{last name}", "first-dot-last"],
    ["first_name.last_name", "first-dot-last"],
    ["{first initial}.{last name}", "f-dot-last"],
    ["firstinitial.lastname", "f-dot-last"],
    ["flast", "flast"],
    ["flastname", "flast"],
    ["{first initial}{last name}", "flast"],
    ["firstname", "first"],
    ["name", "first"],
    ["{first name}", "first"],
    ["first_last", "first-underscore-last"],
    ["lastname.firstname", "last-dot-first"],
    ["firstnamel", "firstl"],
    ["Vorname.Nachname", "first-dot-last"],
  ])("%s → %s", (text, id) => {
    expect(describedPattern(text)).toBe(id)
  })

  it.each(["info", "hello", "initials", "lcplast", "[name/department]", "topic", "sales", "lg", ""])("rejects %j", (text) => {
    expect(describedPattern(text)).toBeNull()
  })
})

describe("parseStatement", () => {
  it("takes the domain written in each alternative", () => {
    expect(parseStatement("first.last@acme.com or flast@avenga.com", null)).toEqual([
      { domain: "acme.com", patternId: "first-dot-last" },
      { domain: "avenga.com", patternId: "flast" },
    ])
  })

  it("splits lists and falls back to the company's domain", () => {
    expect(parseStatement("{first name}{last name}, {first initial}{last name}, {first name}", "https://www.crossell.ie/")).toEqual([
      { domain: "crossell.ie", patternId: "firstlast" },
      { domain: "crossell.ie", patternId: "flast" },
      { domain: "crossell.ie", patternId: "first" },
    ])
  })

  it("ignores what it can't read", () => {
    expect(parseStatement("[name/department]@acme.com", null)).toEqual([])
    expect(parseStatement("initials@acme.com", null)).toEqual([])
  })
})

describe("isFreeMail", () => {
  it("knows the big providers", () => {
    expect(isFreeMail("gmail.com")).toBe(true)
    expect(isFreeMail("Hot.ee")).toBe(true)
    expect(isFreeMail("acme.com")).toBe(false)
    expect(isFreeMail("pec.it")).toBe(true)
    expect(isFreeMail("bluewin.ch")).toBe(true)
  })
})

describe("collectEvidence and domainWeights", () => {
  it("counts a repeated address once, skips free mail and merges statements", () => {
    const { byDomain, counts } = collectEvidence([
      { name: "Jane Doe", email: "jane.doe@acme.com", company: "Acme" },
      { name: "Jane Doe", email: "Jane.Doe@acme.com" },
      { name: "John Smith", email: "john.smith@acme.com" },
      { name: "Private Person", email: "private.person@gmail.com" },
      { statement: "firstname.lastname@acme.com or flast@acme.com", weight: 4 },
    ])
    expect(counts.skippedFreeMail).toBe(1)
    expect(byDomain.has("gmail.com")).toBe(false)
    const acme = byDomain.get("acme.com")!
    expect(acme.company).toBe("Acme")
    expect(acme.samples.size).toBe(2)

    const { patterns, sampleCount } = domainWeights("acme.com", acme)
    expect(patterns[0]).toEqual({ patternId: "first-dot-last", weight: 4 })
    expect(patterns[1]).toEqual({ patternId: "flast", weight: 2 })
    expect(sampleCount).toBe(6)
  })

  it("caps a statement's weight", () => {
    const { byDomain } = collectEvidence([{ statement: "first@x.com", weight: 40 }])
    expect(domainWeights("x.com", byDomain.get("x.com")!).patterns).toEqual([{ patternId: "first", weight: 5 }])
  })
})

describe("mergeWeights", () => {
  it("adds new evidence to what a domain already has", () => {
    const merged = mergeWeights(
      { patterns: [{ patternId: "first", weight: 3 }], sampleCount: 3 },
      { patterns: [{ patternId: "first", weight: 1 }, { patternId: "flast", weight: 5 }], sampleCount: 6 },
    )
    expect(merged).toEqual({ patterns: [{ patternId: "flast", weight: 5 }, { patternId: "first", weight: 4 }], sampleCount: 9 })
    expect(mergeWeights(null, { patterns: [], sampleCount: 0 })).toEqual({ patterns: [], sampleCount: 0 })
  })
})

describe("parseMailHostLine", () => {
  it("reads lookup lines and skips bad ones", () => {
    expect(parseMailHostLine('{"domain":"Acme.com","accepts_mail":true,"mx":["x"],"host":"Microsoft 365"}')).toEqual({ domain: "acme.com", acceptsMail: true, host: "Microsoft 365" })
    expect(parseMailHostLine('{"domain":"x.com","accepts_mail":null,"mx":[],"host":null}')).toEqual({ domain: "x.com", acceptsMail: null, host: null })
    expect(parseMailHostLine("not json")).toBeNull()
    expect(parseMailHostLine('{"domain":"nope"}')).toBeNull()
  })
})
