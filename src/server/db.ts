import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { importSamples } from "./import-samples"
import { openStore, type Store } from "./store"

const DATA_DIR = process.env.DATA_DIR ?? resolve("data")
const DEV_SEED = resolve("seed/dev-samples.jsonl")

let store: Store | null = null
let seeding: Promise<unknown> | null = null

/** The process-wide store. In development an empty store fills itself from the made-up seed. */
export async function getStore(): Promise<Store> {
  if (!store) {
    store = openStore(resolve(DATA_DIR, "emailpattern.sqlite"))
    if (import.meta.env.DEV && store.countDomains() === 0 && existsSync(DEV_SEED)) {
      seeding = importSamples(store, DEV_SEED)
    }
  }
  if (seeding) await seeding
  return store
}

/** Domains need this many matched people before their page is indexed. Thinner pages stay noindex. */
export const INDEXABLE_MIN_SAMPLES = 3
