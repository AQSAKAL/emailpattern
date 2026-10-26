import { describe, expect, it } from "vitest"
import { isFreeMail } from "../src/lib/email/free-mail"
import { consumerPlatforms, ispDomains, registrableHost } from "../src/lib/email/mail-platforms"

const free = (d: string) => ["elisanet.fi", "kolumbus.fi", "hotmail.be", "live.be"].includes(d)

const records = [
  { domain: "elisanet.fi", mx: ["mx-tnl.mail.saunalahti.fi"] },
  { domain: "kolumbus.fi", mx: ["mx-stp.mail.saunalahti.fi"] },
  { domain: "hotmail.be", mx: ["eur.olc.protection.outlook.com"] },
  { domain: "live.be", mx: ["eur.olc.protection.outlook.com"] },
  { domain: "kotinet.com", mx: ["mx-tnl.mail.saunalahti.fi"] },
  { domain: "nhs.net", mx: ["nhs-net.mail.protection.outlook.com"] },
  { domain: "smallfirm.fi", mx: ["mail12.domainhotelli.fi"] },
]

describe("registrableHost", () => {
  it.each([
    ["mx-tnl.mail.saunalahti.fi", "saunalahti.fi"],
    ["nhs-net.mail.protection.outlook.com.", "outlook.com"],
    ["mx1.example.co.uk", "example.co.uk"],
    ["localhost", "localhost"],
  ])("%s → %s", (host, expected) => {
    expect(registrableHost(host)).toBe(expected)
  })
})

describe("consumerPlatforms and ispDomains", () => {
  const sites = new Map([["saunalahti.fi", 10], ["outlook.com", 360000], ["domainhotelli.fi", 1117]])

  it("finds a consumer platform and the ISP domains on it, not business platforms", () => {
    const platforms = consumerPlatforms(records, free, sites)
    expect([...platforms]).toEqual(["saunalahti.fi"])
    expect(ispDomains(records, platforms, free)).toEqual(["kotinet.com"])
  })

  it("ignores a platform that carries many company sites", () => {
    const busy = new Map([["saunalahti.fi", 5000]])
    expect(consumerPlatforms(records, free, busy).size).toBe(0)
  })
})

describe("isFreeMail", () => {
  it("covers the open list, generated ISPs and reserved names", () => {
    expect(isFreeMail("hotmail.be")).toBe(true)
    expect(isFreeMail("example.com")).toBe(true)
    expect(isFreeMail("acme.example")).toBe(true)
    expect(isFreeMail("tobii.com")).toBe(false)
    expect(isFreeMail("nhs.net")).toBe(false)
  })
})
