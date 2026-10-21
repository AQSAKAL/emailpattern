// Reading people from CSV text and writing results back. Pure.

import { parse } from "csv-parse/sync"
import { stringify } from "csv-stringify/sync"

export const NAME_COLUMNS = ["name", "full_name", "full name", "person", "contact"]
export const DOMAIN_COLUMNS = ["domain", "website", "company_domain", "company website", "url", "site"]
export const RESULT_COLUMNS = ["email", "pattern", "confidence", "known_domain", "accepts_mail"]

export function readCsv(text) {
  const rows = parse(text.replace(/^﻿/, ""), { columns: true, skip_empty_lines: true, relax_column_count: true })
  const headers = rows.length ? Object.keys(rows[0]) : (parse(text, { to_line: 1 })[0] ?? [])
  return { headers, rows }
}

/** The header to read: the one asked for, else the first that looks right (case-insensitive). */
export function pickColumn(headers, wanted, candidates) {
  const byLower = new Map(headers.map((h) => [h.trim().toLowerCase(), h]))
  if (wanted) return byLower.get(wanted.trim().toLowerCase()) ?? null
  for (const c of candidates) if (byLower.has(c)) return byLower.get(c)
  return null
}

export function* batches(items, size) {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size)
}

/** The columns a bulk run adds for one person. */
export function resultFields(result) {
  const best = result.candidates?.[0] ?? {}
  const accepts = result.mail?.accepts_mail
  return {
    email: best.email ?? "",
    pattern: best.template ?? "",
    confidence: best.confidence === undefined ? "" : best.confidence.toFixed(3),
    known_domain: result.known_domain ? "yes" : "no",
    accepts_mail: accepts == null ? "" : accepts ? "yes" : "no",
    ...(result.error ? { error: result.error } : {}),
  }
}

export function writeCsv(headers, rows) {
  const columns = [...headers, ...[...RESULT_COLUMNS, "error"].filter((c) => !headers.includes(c))]
  return stringify(rows, { header: true, columns })
}
