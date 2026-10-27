import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { openStore } from "../src/server/store"

const dirs: string[] = []
function store() {
  const dir = mkdtempSync(join(tmpdir(), "ep-store-"))
  dirs.push(dir)
  return openStore(join(dir, "s.sqlite"))
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

const at = "2026-10-21T00:00:00Z"

describe("patternMix", () => {
  it("counts each company once, overall and per mail host", () => {
    const s = store()
    s.upsertDomain({ domain: "a.com", companyName: null, sampleCount: 10, patterns: [{ patternId: "first", weight: 10 }], updatedAt: at })
    s.upsertDomain({ domain: "b.com", companyName: null, sampleCount: 2, patterns: [{ patternId: "first-dot-last", weight: 1 }, { patternId: "first", weight: 1 }], updatedAt: at })
    s.upsertDomain({ domain: "c.com", companyName: null, sampleCount: 1, patterns: [{ patternId: "flast", weight: 1 }], updatedAt: at })
    s.upsertMailHosts(
      [
        { domain: "a.com", acceptsMail: true, host: "Google Workspace" },
        { domain: "b.com", acceptsMail: true, host: "Google Workspace" },
        { domain: "z.com", acceptsMail: false, host: null },
      ],
      at,
    )
    const mix = s.patternMix()
    expect(mix.overall.domains).toBe(3)
    expect(mix.overall.shares.get("first")).toBeCloseTo(1.5)
    expect(mix.overall.shares.get("flast")).toBeCloseTo(1)
    const google = mix.byHost.get("Google Workspace")!
    expect(google.domains).toBe(2)
    expect(google.shares.get("first-dot-last")).toBeCloseTo(0.5)
    expect(s.getMailHost("z.com")).toEqual({ domain: "z.com", acceptsMail: false, host: null })
    expect(s.getMailHost("nowhere.com")).toBeNull()
    s.close()
  })
})

describe("indexable domains", () => {
  it("leaves out domains known not to take mail, but keeps unchecked ones", () => {
    const s = store()
    for (const domain of ["mail.com", "nomail.com", "unchecked.com", "thin.com"]) {
      s.upsertDomain({ domain, companyName: null, sampleCount: domain === "thin.com" ? 1 : 5, patterns: [{ patternId: "first", weight: 5 }], updatedAt: at })
    }
    s.upsertMailHosts(
      [
        { domain: "mail.com", acceptsMail: true, host: "Google Workspace" },
        { domain: "nomail.com", acceptsMail: false, host: null },
      ],
      at,
    )
    expect(s.domainPage(0, 10, 3)).toEqual(["mail.com", "unchecked.com"])
    expect(s.countIndexable(3)).toBe(2)
    expect(s.listDomains({ minSamples: 3 }).map((d) => d.domain)).toEqual(["mail.com", "unchecked.com"])
    expect(s.countDomains()).toBe(4)
    s.close()
  })
})

describe("released pages", () => {
  it("offers companies without evidence that take mail, biggest first, and releases them in batches", () => {
    const s = store()
    s.upsertDomain({ domain: "known.com", companyName: null, sampleCount: 3, patterns: [{ patternId: "first", weight: 3 }], updatedAt: at })
    s.upsertMailHosts(
      [
        { domain: "known.com", acceptsMail: true, host: null },
        { domain: "big.com", acceptsMail: true, host: "Microsoft 365" },
        { domain: "small.com", acceptsMail: true, host: null },
        { domain: "dead.com", acceptsMail: false, host: null },
      ],
      at,
    )
    const fact = (domain: string, employees: number | null) => ({
      domain, rank: 1, name: domain, country: "SE", foundedYear: null, industry: null, legalForm: null, employees,
      employeesExact: false, revenue: null, currency: null, financialYear: null,
    })
    return s.replaceCompanies([fact("known.com", 900), fact("small.com", 5), fact("big.com", 500), fact("dead.com", 800), fact("nomx.com", 1)]).then(() => {
      expect([...s.releaseCandidates()].map((c) => c.domain)).toEqual(["big.com", "small.com"])
      expect(s.releasePages(["big.com"])).toBe(1)
      expect(s.releasePages(["small.com", "dead.com"])).toBe(2)
      expect(s.isReleased("big.com")).toBe(true)
      expect([...s.releaseCandidates()]).toEqual([])
      expect(s.releasedPage(0, 10)).toEqual(["big.com", "small.com"])
      expect(s.countReleased()).toBe(2)
      s.close()
    })
  })
})
