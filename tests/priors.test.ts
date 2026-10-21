import { describe, expect, it } from "vitest"
import { rankCandidates } from "../src/lib/email/candidates"
import { CATALOGUE_PRIOR, FULL_TRUST_DOMAINS, MIN_HOST_DOMAINS, blend, priorFor, type PatternMix } from "../src/lib/email/priors"

const mix = (shares: Record<string, number>, domains: number) => ({ shares: new Map(Object.entries(shares)), domains })
const sum = (m: ReadonlyMap<string, number>) => [...m.values()].reduce((a, b) => a + b, 0)

describe("blend", () => {
  it("trusts a measured mix in proportion to the companies behind it", () => {
    const few = blend(mix({ first: 10 }, 10), CATALOGUE_PRIOR)
    const many = blend(mix({ first: 1000 }, FULL_TRUST_DOMAINS), CATALOGUE_PRIOR)
    expect(few.get("first")!).toBeLessThan(many.get("first")!)
    expect(many.get("first")!).toBeGreaterThan(0.95)
  })

  it("stays a distribution and never rules a format out", () => {
    const b = blend(mix({ first: 1000 }, 10_000), CATALOGUE_PRIOR)
    expect(sum(b)).toBeCloseTo(1, 9)
    expect(b.get("last-dot-first")!).toBeGreaterThan(0)
  })
})

describe("priorFor", () => {
  const data: PatternMix = {
    overall: mix({ "first-dot-last": 600, first: 400 }, 1000),
    byHost: new Map([
      ["Google Workspace", mix({ first: 300 }, 300)],
      ["Tiny Host", mix({ flast: 5 }, MIN_HOST_DOMAINS - 1)],
    ]),
  }

  it("falls back to the catalogue without data", () => {
    expect(priorFor(null, "Google Workspace").basis).toBe("catalogue")
  })

  it("uses the mail host's own mix when enough companies are on it", () => {
    const { prior, basis } = priorFor(data, "Google Workspace")
    expect(basis).toBe("mail_host")
    expect(prior.get("first")!).toBeGreaterThan(0.9)
  })

  it("uses the overall mix for small or unknown hosts", () => {
    expect(priorFor(data, "Tiny Host").basis).toBe("overall")
    const { prior, basis } = priorFor(data, null)
    expect(basis).toBe("overall")
    expect(prior.get("first-dot-last")!).toBeGreaterThan(prior.get("first")!)
  })

  it("changes what an unknown company is expected to use", () => {
    const jane = { first: "jane", last: "doe" }
    const onGoogle = rankCandidates(jane, "x.com", [], 1, priorFor(data, "Google Workspace").prior)
    const elsewhere = rankCandidates(jane, "x.com", [], 1, priorFor(data, null).prior)
    expect(onGoogle[0].email).toBe("jane@x.com")
    expect(elsewhere[0].email).toBe("jane.doe@x.com")
  })
})
