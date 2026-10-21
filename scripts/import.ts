// Learns domain formats from a JSON Lines file of {name, email, company?} and writes them to the store.
//   npm run import -- path/to/samples.jsonl
import { resolve } from "node:path"
import { importSamples } from "../src/server/import-samples"
import { openStore } from "../src/server/store"

const file = process.argv[2]
if (!file) {
  console.error("usage: npm run import -- <samples.jsonl>")
  process.exit(1)
}

const store = openStore(resolve(process.env.DATA_DIR ?? "data", "emailpattern.sqlite"))
const counts = await importSamples(store, resolve(file))
store.close()
console.log(
  `${counts.lines} lines: ${counts.samples} addresses and ${counts.statements} stated formats ` +
    `(${counts.skippedFreeMail} free-mail skipped) → ${counts.domains} domains`,
)
