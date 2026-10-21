import { describe, expect, it } from "vitest"
import { LOCALE_CODES, dictionary, fill, localePath, splitPlaceholders, unlocalizedPath } from "../src/i18n"
import { formatShare } from "../src/i18n/format"
import { PATTERNS } from "../src/lib/email/patterns"

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))
  return typeof value
}

function placeholders(value: unknown, path = ""): string[] {
  if (typeof value === "string") return [...value.matchAll(/\{(\w+)\}/g)].map((m) => `${path}:${m[1]}`)
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => placeholders(v, `${path}.${k}`))
  return []
}

describe("dictionaries", () => {
  const en = dictionary("en")

  it.each(LOCALE_CODES)("%s has the same keys and list lengths as English", (locale) => {
    expect(shape(dictionary(locale))).toEqual(shape(en))
  })

  it.each(LOCALE_CODES)("%s uses the same placeholders as English", (locale) => {
    expect(placeholders(dictionary(locale)).sort()).toEqual(placeholders(en).sort())
  })

  it("labels every pattern", () => {
    expect(Object.keys(en.patternLabels).sort()).toEqual(PATTERNS.map((p) => p.id).sort())
  })
})

describe("locale paths", () => {
  it("keeps English at the root and prefixes the rest", () => {
    expect(localePath("en", "/stripe.com")).toBe("/stripe.com")
    expect(localePath("de", "/stripe.com")).toBe("/de/stripe.com")
    expect(localePath("de", "/")).toBe("/de/")
  })

  it("strips a language prefix", () => {
    expect(unlocalizedPath("/de/stripe.com")).toBe("/stripe.com")
    expect(unlocalizedPath("/stripe.com")).toBe("/stripe.com")
    expect(unlocalizedPath("/de/")).toBe("/")
  })

  it("fills placeholders", () => {
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}")
  })

  it("splits at placeholders left for markup", () => {
    expect(splitPlaceholders("Use {template}, e.g. {example}.")).toEqual(["Use ", { key: "template" }, ", e.g. ", { key: "example" }, "."])
  })
})

describe("formatShare", () => {
  it("never shows a non-zero share as 0 %", () => {
    expect(formatShare("en", 0.001)).toBe("<1%")
    expect(formatShare("en", 0)).toBe("0%")
    expect(formatShare("en", 0.42)).toBe("42%")
  })
})
