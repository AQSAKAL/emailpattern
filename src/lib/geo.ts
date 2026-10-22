// Pure parts of the IP-to-country lookup: which files to fetch and what to keep from a record.
// Reading and refreshing the databases is src/server/geo.ts.

export type GeoKind = "country" | "asn"

export interface Geo {
  /** ISO 3166-1 alpha-2, e.g. "DE". */
  country: string | null
  asn: number | null
  /** The network's owner, e.g. "Hetzner Online GmbH"; tells data centres from homes and offices. */
  as_org: string | null
}

export const NO_GEO: Geo = { country: null, asn: null, as_org: null }

const month = (date: Date) => date.toISOString().slice(0, 7)

/** DB-IP Lite publishes once a month; last month's file stands in until this month's is out. */
export function geoUrls(kind: GeoKind, now: Date): string[] {
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return [now, previous].map((date) => `https://download.db-ip.com/free/dbip-${kind}-lite-${month(date)}.mmdb.gz`)
}

interface CountryRecord {
  country?: { iso_code?: string }
  registered_country?: { iso_code?: string }
}

interface AsnRecord {
  autonomous_system_number?: number
  autonomous_system_organization?: string
}

export function geoFields(country: CountryRecord | null, asn: AsnRecord | null): Geo {
  return {
    country: country?.country?.iso_code ?? country?.registered_country?.iso_code ?? null,
    asn: asn?.autonomous_system_number ?? null,
    as_org: asn?.autonomous_system_organization?.slice(0, 100) ?? null,
  }
}
