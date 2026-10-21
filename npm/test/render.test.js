import assert from "node:assert/strict"
import { test } from "node:test"
import { palette } from "../src/colors.js"
import { addressFormat, bulkSummary, domainResult, findResult, panel, percent } from "../src/render.js"

const plain = palette(false)
const RESULT = {
  query: { domain: "acme.com", name: "Jane Doe" },
  domain: "acme.com",
  error: null,
  company_name: "Acme",
  known_domain: true,
  sample_count: 41,
  candidates: [
    { email: "jane.doe@acme.com", pattern: "first-dot-last", template: "{first}.{last}@acme.com", confidence: 0.86 },
    { email: "jdoe@acme.com", pattern: "flast", template: "{f}{last}@acme.com", confidence: 0.08 },
  ],
  mail: { accepts_mail: true, host: "Google Workspace" },
}

test("percent never shows a real share as zero", () => {
  assert.equal(percent(0.86), "86%")
  assert.equal(percent(0.004), "<1%")
  assert.equal(percent(0.005), "1%")
  assert.equal(percent(0), "0%")
})

test("address format keeps the template text and colours tokens when colour is on", () => {
  assert.equal(addressFormat("{f}.{last}@acme.com", plain), "{f}.{last}@acme.com")
  assert.match(addressFormat("{first}@a.com", palette(true)), /\x1b\[38;2;95;212;126mfirst/)
})

test("panel lines up its borders around wide and coloured text", () => {
  const lines = panel(["short", palette(true).leaf("coloured")], " t ", plain).split("\n")
  assert.equal(new Set(lines.map((l) => l.replace(/\x1b\[[0-9;]*m/g, "").length)).size, 1)
})

test("find result shows the address, the odds and the mail host", () => {
  const out = findResult(RESULT, plain)
  assert.match(out, /jane\.doe@acme\.com/)
  assert.match(out, /86% of the 41 people/)
  assert.match(out, /Google Workspace/)
  assert.match(out, /jdoe@acme\.com/)
})

test("unknown domain and invalid input are explained", () => {
  assert.match(findResult({ ...RESULT, known_domain: false }, plain), /No addresses from acme\.com yet/)
  assert.match(findResult({ ...RESULT, error: "invalid_domain", query: { domain: "nope" }, candidates: [] }, plain), /doesn't look like a website/)
})

test("domain result lists formats without repeating the domain", () => {
  const out = domainResult({ ...RESULT, candidates: RESULT.candidates.map((c) => ({ ...c, email: null })) }, plain)
  assert.match(out, /\{first\}\.\{last\}/)
  assert.doesNotMatch(out, /\{first\}\.\{last\}@acme\.com/)
  assert.match(out, /Based on 41 people/)
})

test("bulk summary pluralises skipped rows", () => {
  assert.match(bulkSummary({ found: 3, known: 2, failed: 1, output: "o.csv" }, plain), /1 row skipped/)
  assert.doesNotMatch(bulkSummary({ found: 3, known: 2, failed: 0, output: "o.csv" }, plain), /skipped/)
})
