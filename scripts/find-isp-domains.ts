// Writes src/lib/email/isp-domains.json: domains whose mail runs on the same consumer
// platform as known free-mail providers.
//   tsx scripts/find-isp-domains.ts <mx.jsonl> <candidates.txt> <business-sites.json>
// mx.jsonl: {domain, mx: [...]} for the known providers and the candidates.
// candidates.txt: domains to classify, one per line (e.g. learned domains that are not a
// crawled company's own website).
// business-sites.json: {platform: number of crawled company websites whose mail it carries}.
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { isCuratedFreeMail, isListedFreeMail } from "../src/lib/email/free-mail"
import { consumerPlatforms, ispDomains, type MxRecord } from "../src/lib/email/mail-platforms"

const [mxFile, candidatesFile, sitesFile] = process.argv.slice(2)
if (!mxFile || !candidatesFile || !sitesFile) {
  console.error("usage: tsx scripts/find-isp-domains.ts <mx.jsonl> <candidates.txt> <business-sites.json>")
  process.exit(1)
}

const records: MxRecord[] = readFileSync(mxFile, "utf8").trim().split("\n").map((l) => JSON.parse(l))
const wanted = new Set(readFileSync(candidatesFile, "utf8").split("\n").map((d) => d.trim()).filter(Boolean))
// Platforms are read only from providers people really use: the curated list, plus open-list
// providers that occur among the candidates. The open list alone is mostly throwaway domains
// on shared hosting, which would mark ordinary hosts as consumer platforms.
const realProvider = (d: string) => isCuratedFreeMail(d) || (isListedFreeMail(d) && wanted.has(d))
const businessSites = new Map<string, number>(Object.entries(JSON.parse(readFileSync(sitesFile, "utf8"))))
const platforms = consumerPlatforms(records, realProvider, businessSites)
const found = ispDomains(records.filter((r) => wanted.has(r.domain)), platforms, isListedFreeMail)

writeFileSync(resolve("src/lib/email/isp-domains.json"), JSON.stringify(found, null, 0) + "\n")
console.log(`${platforms.size} consumer platforms → ${found.length} ISP domains`)
console.log([...platforms].sort().join(" "))
