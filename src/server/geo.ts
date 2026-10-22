import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { gunzipSync } from "node:zlib"
import { Reader, type AsnResponse, type CountryResponse } from "maxmind"
import { geoFields, geoUrls, type Geo, type GeoKind, NO_GEO } from "../lib/geo"

// Country and network for a caller's IP, from DB-IP's free monthly databases kept in
// $DATA_DIR/geo. The app fetches them itself when missing or a month old, so a deploy
// needs nothing extra; until they arrive lookups return nulls.

const DIR = resolve(process.env.DATA_DIR ?? "data", "geo")
const MAX_AGE_MS = 32 * 24 * 3600 * 1000
const CHECK_EVERY_MS = 24 * 3600 * 1000

interface Readers {
  country: Reader<CountryResponse> | null
  asn: Reader<AsnResponse> | null
}

const file = (kind: GeoKind) => resolve(DIR, `${kind}.mmdb`)

async function open<T extends CountryResponse | AsnResponse>(kind: GeoKind): Promise<Reader<T> | null> {
  try {
    return new Reader<T>(await readFile(file(kind)))
  } catch {
    return null
  }
}

async function isFresh(kind: GeoKind): Promise<boolean> {
  try {
    return Date.now() - (await stat(file(kind))).mtimeMs < MAX_AGE_MS
  } catch {
    return false
  }
}

/** Downloads this month's file, or last month's while this month's is not out yet. */
async function download(kind: GeoKind): Promise<void> {
  for (const url of geoUrls(kind, new Date())) {
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
    if (!response.ok) continue
    const data = gunzipSync(Buffer.from(await response.arrayBuffer()))
    new Reader(data) // throws on a broken file before it replaces a good one
    await mkdir(DIR, { recursive: true })
    await writeFile(`${file(kind)}.tmp`, data)
    await rename(`${file(kind)}.tmp`, file(kind))
    return
  }
  throw new Error(`no ${kind} database at ${geoUrls(kind, new Date()).join(" or ")}`)
}

const holder = globalThis as { __emailpatternGeo?: Readers }

async function refresh(readers: Readers): Promise<void> {
  for (const kind of ["country", "asn"] as const) {
    try {
      if (!(await isFresh(kind))) await download(kind)
    } catch (error) {
      console.warn(`geo: could not update the ${kind} database`, error)
    }
    if (kind === "country") readers.country = (await open<CountryResponse>(kind)) ?? readers.country
    else readers.asn = (await open<AsnResponse>(kind)) ?? readers.asn
  }
}

function readers(): Readers {
  if (holder.__emailpatternGeo) return holder.__emailpatternGeo
  const created: Readers = { country: null, asn: null }
  holder.__emailpatternGeo = created
  void refresh(created)
  setInterval(() => void refresh(created), CHECK_EVERY_MS).unref()
  return created
}

export function lookupGeo(ip: string): Geo {
  const { country, asn } = readers()
  try {
    return geoFields(country?.get(ip) ?? null, asn?.get(ip) ?? null)
  } catch {
    return NO_GEO
  }
}
