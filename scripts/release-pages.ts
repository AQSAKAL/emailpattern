// Lets the next batch of domains with no address evidence into the index (English pages only).
//   npm run -s release-pages -- 100000
import { resolve } from "node:path"
import { pickRelease } from "../src/server/release-pages"
import { openStore } from "../src/server/store"

const count = Number(process.argv[2])
if (!Number.isInteger(count) || count <= 0) {
  console.error("usage: npm run -s release-pages -- <count>")
  process.exit(1)
}
const store = openStore(resolve(process.env.DATA_DIR ?? "data", "emailpattern.sqlite"))
const domains = pickRelease(store.releaseCandidates(), count)
const batch = store.releasePages(domains)
console.log(`batch ${batch}: ${domains.length} domains released, ${store.countReleased()} in all`)
store.close()
