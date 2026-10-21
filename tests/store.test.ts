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
