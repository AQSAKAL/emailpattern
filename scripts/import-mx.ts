// Loads mail hosts from JSON Lines of {domain, accepts_mail, host} (as written by an MX lookup
// run) into the store, so lookups and pages use them instead of a live DNS query.
//   npm run import-mx -- path/to/mx.jsonl
import { createReadStream } from "node:fs"
import { resolve } from "node:path"
import { createInterface } from "node:readline"
import { parseMailHostLine } from "../src/server/mail-hosts"
import { openStore, type MailHost } from "../src/server/store"

const file = process.argv[2]
if (!file) {
  console.error("usage: npm run import-mx -- <mx.jsonl>")
  process.exit(1)
}

const store = openStore(resolve(process.env.DATA_DIR ?? "data", "emailpattern.sqlite"))
const checkedAt = new Date().toISOString()
let batch: MailHost[] = []
let total = 0
let skipped = 0
for await (const line of createInterface({ input: createReadStream(resolve(file)), crlfDelay: Infinity })) {
  const row = parseMailHostLine(line)
  if (!row) {
    skipped++
    continue
  }
  batch.push(row)
  if (batch.length === 50_000) {
    total += store.upsertMailHosts(batch, checkedAt)
    batch = []
  }
}
total += store.upsertMailHosts(batch, checkedAt)
store.close()
console.log(`${total} mail hosts loaded, ${skipped} lines skipped`)
