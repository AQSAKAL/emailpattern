// Learns domain formats from JSON Lines of {name, email, company?} or {statement, domain?, weight?}
// and adds them to the store (--replace overwrites each domain's formats instead).
//   npm run import -- path/to/samples.jsonl [--replace]
import { resolve } from "node:path"
import { importSamples } from "../src/server/import-samples"
import { openStore } from "../src/server/store"

const file = process.argv.slice(2).find((a) => !a.startsWith("--"))
const replace = process.argv.includes("--replace")
if (!file) {
  console.error("usage: npm run import -- <samples.jsonl> [--replace]")
  process.exit(1)
}

const store = openStore(resolve(process.env.DATA_DIR ?? "data", "emailpattern.sqlite"))
const counts = await importSamples(store, resolve(file), { replace })
store.close()
console.log(
  `${counts.lines} lines: ${counts.samples} addresses and ${counts.statements} stated formats ` +
    `(${counts.skippedFreeMail} free-mail skipped) → ${counts.domains} domains`,
)
