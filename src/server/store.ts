import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"
import type { PatternWeight } from "../lib/email/candidates"

export interface DomainRecord {
  domain: string
  companyName: string | null
  /** People whose address matched a known pattern. */
  sampleCount: number
  patterns: PatternWeight[]
  updatedAt: string
}

export interface DomainListing {
  domain: string
  companyName: string | null
  primaryPattern: string | null
  sampleCount: number
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS domains (
    domain TEXT PRIMARY KEY,
    company_name TEXT,
    sample_count INTEGER NOT NULL,
    primary_pattern TEXT,
    updated_at TEXT NOT NULL
  ) WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS domains_by_pattern ON domains (primary_pattern, domain);
  CREATE TABLE IF NOT EXISTS domain_patterns (
    domain TEXT NOT NULL,
    pattern_id TEXT NOT NULL,
    weight REAL NOT NULL,
    PRIMARY KEY (domain, pattern_id)
  ) WITHOUT ROWID;
`

type Row = Record<string, unknown>

function toListing(row: Row): DomainListing {
  return {
    domain: row.domain as string,
    companyName: (row.company_name as string | null) ?? null,
    primaryPattern: (row.primary_pattern as string | null) ?? null,
    sampleCount: Number(row.sample_count),
  }
}

/** Opens (and creates) the SQLite file that holds every domain's learned formats. */
export function openStore(path: string) {
  mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")
  db.exec(SCHEMA)

  const selectDomain = db.prepare("SELECT * FROM domains WHERE domain = ?")
  const selectPatterns = db.prepare("SELECT pattern_id, weight FROM domain_patterns WHERE domain = ? ORDER BY weight DESC")
  const upsertDomainRow = db.prepare(`
    INSERT INTO domains (domain, company_name, sample_count, primary_pattern, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (domain) DO UPDATE SET
      company_name = coalesce(excluded.company_name, domains.company_name),
      sample_count = excluded.sample_count,
      primary_pattern = excluded.primary_pattern,
      updated_at = excluded.updated_at
  `)
  const deletePatterns = db.prepare("DELETE FROM domain_patterns WHERE domain = ?")
  const insertPattern = db.prepare("INSERT INTO domain_patterns (domain, pattern_id, weight) VALUES (?, ?, ?)")

  return {
    getDomain(domain: string): DomainRecord | null {
      const row = selectDomain.get(domain) as Row | undefined
      if (!row) return null
      const patterns = (selectPatterns.all(domain) as Row[]).map((p) => ({
        patternId: p.pattern_id as string,
        weight: Number(p.weight),
      }))
      return {
        domain,
        companyName: (row.company_name as string | null) ?? null,
        sampleCount: Number(row.sample_count),
        patterns,
        updatedAt: row.updated_at as string,
      }
    },

    /** Keyset-paginated listing in domain order, optionally under one leading character. */
    listDomains({ prefix = "", after = "", limit = 200, minSamples = 0 }: { prefix?: string; after?: string; limit?: number; minSamples?: number }): DomainListing[] {
      const rows = db
        .prepare(
          `SELECT domain, company_name, primary_pattern, sample_count FROM domains
           WHERE domain > ? AND domain LIKE ? ESCAPE '\\' AND sample_count >= ?
           ORDER BY domain LIMIT ?`,
        )
        .all(after, `${prefix.replace(/[\\%_]/g, "\\$&")}%`, minSamples, limit) as Row[]
      return rows.map(toListing)
    },

    /** One sitemap-sized slice of indexable domains. */
    domainPage(offset: number, limit: number, minSamples: number): string[] {
      const rows = db
        .prepare("SELECT domain FROM domains WHERE sample_count >= ? ORDER BY domain LIMIT ? OFFSET ?")
        .all(minSamples, limit, offset) as Row[]
      return rows.map((r) => r.domain as string)
    },

    countDomains(minSamples = 0): number {
      const row = db.prepare("SELECT count(*) AS n FROM domains WHERE sample_count >= ?").get(minSamples) as Row
      return Number(row.n)
    },

    domainsUsingPattern(patternId: string, limit: number, excludeDomain = ""): DomainListing[] {
      const rows = db
        .prepare(
          `SELECT domain, company_name, primary_pattern, sample_count FROM domains
           WHERE primary_pattern = ? AND domain != ? ORDER BY sample_count DESC LIMIT ?`,
        )
        .all(patternId, excludeDomain, limit) as Row[]
      return rows.map(toListing)
    },

    /** How many domains use each pattern as their main format. */
    primaryPatternCounts(): Map<string, number> {
      const rows = db
        .prepare("SELECT primary_pattern, count(*) AS n FROM domains WHERE primary_pattern IS NOT NULL GROUP BY 1")
        .all() as Row[]
      return new Map(rows.map((r) => [r.primary_pattern as string, Number(r.n)]))
    },

    upsertDomain(record: DomainRecord): void {
      const primary = record.patterns.reduce<PatternWeight | null>((best, p) => (!best || p.weight > best.weight ? p : best), null)
      db.exec("BEGIN")
      try {
        upsertDomainRow.run(record.domain, record.companyName, record.sampleCount, primary?.patternId ?? null, record.updatedAt)
        deletePatterns.run(record.domain)
        for (const p of record.patterns) insertPattern.run(record.domain, p.patternId, p.weight)
        db.exec("COMMIT")
      } catch (error) {
        db.exec("ROLLBACK")
        throw error
      }
    },

    close(): void {
      db.close()
    },
  }
}

export type Store = ReturnType<typeof openStore>
