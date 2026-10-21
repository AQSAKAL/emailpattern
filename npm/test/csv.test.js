import assert from "node:assert/strict"
import { test } from "node:test"
import { DOMAIN_COLUMNS, NAME_COLUMNS, batches, pickColumn, readCsv, resultFields, writeCsv } from "../src/csv.js"

test("pickColumn matches common headers case-insensitively", () => {
  const headers = ["Full Name", "Website", "Notes"]
  assert.equal(pickColumn(headers, null, NAME_COLUMNS), "Full Name")
  assert.equal(pickColumn(headers, null, DOMAIN_COLUMNS), "Website")
  assert.equal(pickColumn(headers, "notes", NAME_COLUMNS), "Notes")
  assert.equal(pickColumn(headers, "missing", NAME_COLUMNS), null)
})

test("batches split with a remainder", () => {
  assert.deepEqual([...batches(Array.from({ length: 120 }), 50)].map((b) => b.length), [50, 50, 20])
})

test("readCsv handles a BOM, quotes and a header-only file", () => {
  const { headers, rows } = readCsv('﻿name,domain\n"Doe, Jane",acme.com\n')
  assert.deepEqual(headers, ["name", "domain"])
  assert.equal(rows[0].name, "Doe, Jane")
  assert.deepEqual(readCsv("name,domain\n").headers, ["name", "domain"])
})

test("resultFields take the best candidate and keep errors", () => {
  assert.deepEqual(
    resultFields({ known_domain: true, candidates: [{ email: "a@b.com", template: "{first}@b.com", confidence: 0.9 }], mail: { accepts_mail: false } }),
    { email: "a@b.com", pattern: "{first}@b.com", confidence: "0.900", known_domain: "yes", accepts_mail: "no" },
  )
  assert.equal(resultFields({ error: "invalid_domain", candidates: [], mail: { accepts_mail: null } }).error, "invalid_domain")
})

test("writeCsv appends the result columns", () => {
  const [header, row] = writeCsv(["name", "domain"], [{ name: "Jane", domain: "b.com", email: "jane@b.com" }]).trim().split("\n")
  assert.equal(header, "name,domain,email,pattern,confidence,known_domain,accepts_mail,error")
  assert.ok(row.startsWith("Jane,b.com,jane@b.com"))
})
