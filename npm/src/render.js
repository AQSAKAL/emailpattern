// Turns API results into terminal text, in the site's forest-and-leaf palette.
// Pure: takes results and a palette from ./colors.js, returns strings.

import { stripVTControlCharacters } from "node:util"

const TOKEN = /\{(first|last|f|l)\}/g
const BAR_WIDTH = 18
const TOKEN_STYLE = { first: "first", last: "last", f: "initial", l: "initial" }

const visible = (text) => stripVTControlCharacters(text).length
const pad = (text, width, align = "left") => {
  const gap = " ".repeat(Math.max(0, width - visible(text)))
  return align === "right" ? gap + text : text + gap
}

/** A rounded box with a title in the top border, like the Python CLI's panel. */
export function panel(lines, title, c, padX = 2) {
  const inner = Math.max(...lines.map(visible), visible(title) + 2) + padX * 2
  const top = c.frame("╭─") + title + c.frame("─".repeat(Math.max(0, inner - visible(title) - 1)) + "╮")
  const row = (text) => c.frame("│") + " ".repeat(padX) + pad(text, inner - padX * 2) + " ".repeat(padX) + c.frame("│")
  return [top, row(""), ...lines.map(row), row(""), c.frame("╰" + "─".repeat(inner) + "╯")].join("\n")
}

/** {first}.{last}@acme.com with each token coloured like on the site. */
export function addressFormat(template, c) {
  const at = template.indexOf("@")
  const local = at === -1 ? template : template.slice(0, at)
  const styled = local.replace(TOKEN, (_, token) => c.brace("{") + c.bold(c[TOKEN_STYLE[token]](token)) + c.brace("}"))
  return at === -1 ? styled : styled + c.muted(template.slice(at))
}

/** The template without its @domain, for tables where the domain repeats on every row. */
export const localPart = (template) => template.split("@")[0]

/** Whole percent; a share that rounds to zero but isn't zero reads "<1%". */
export function percent(share) {
  const whole = Math.floor(share * 100 + 0.5)
  return share > 0 && whole < 1 ? "<1%" : `${whole}%`
}

export function bar(share, strong, c) {
  const filled = share > 0 ? Math.max(1, Math.round(share * BAR_WIDTH)) : 0
  return (strong ? c.leaf : c.sage)("━".repeat(filled)) + c.frame("━".repeat(BAR_WIDTH - filled))
}

export function mailLine(result, c) {
  const { domain } = result
  const accepts = result.mail?.accepts_mail
  if (accepts === false) return c.warn(`✗ ${domain} has no mail server, so messages will bounce.`)
  if (accepts == null) return c.muted(`? Couldn't check ${domain}'s mail server.`)
  return c.leaf("✓ ") + `${domain} receives email` + (result.mail.host ? c.muted(`  ·  ${result.mail.host}`) : "")
}

export function errorText(result, c) {
  if (result.error === "invalid_domain") return c.warn(`“${result.query.domain}” doesn't look like a website. Try something like acme.com.`)
  if (result.error === "invalid_name") return c.warn("Type a first name, or a first and last name.")
  return null
}

/** A borderless table with a rule under the header, like the CLI's Python sibling. */
export function table(headers, rows, c, { align = [], title } = {}) {
  const widths = headers.map((h, i) => Math.max(visible(h), ...rows.map((r) => visible(r[i]))))
  const line = (cells, style = (x) => x) => " " + cells.map((cell, i) => style(pad(cell, widths[i], align[i]))).join("   ")
  const total = widths.reduce((a, b) => a + b, 0) + 3 * (widths.length - 1)
  return [
    ...(title ? [c.sage(title.toUpperCase()), ""] : []),
    line(headers, c.muted),
    " " + c.frame("─".repeat(total)),
    ...rows.map((r) => line(r)),
  ].join("\n")
}

function evidence(result, top, c) {
  return result.known_domain
    ? c.muted(`${percent(top.confidence)} of the ${result.sample_count} people we have seen at ${result.domain} use this format.`)
    : c.muted(`No addresses from ${result.domain} yet, so this is the most common format overall.`)
}

function alternatives(candidates, c, { withEmail, title }) {
  const headers = [...(withEmail ? ["Address"] : []), "Format", "Likelihood"]
  const rows = candidates.map((cand, i) => [
    ...(withEmail ? [cand.email] : []),
    addressFormat(localPart(cand.template), c),
    `${bar(cand.confidence, i === 0 && !withEmail, c)}  ${percent(cand.confidence).padStart(4)}`,
  ])
  return table(headers, rows, c, { align: [...(withEmail ? ["left"] : []), "left", "right"], title })
}

/** The answer for one person: the best address in a panel, then the alternatives. */
export function findResult(result, c) {
  const problem = errorText(result, c)
  if (problem) return problem
  const [top, ...rest] = result.candidates
  const label = c.sage(top.email ? "MOST LIKELY ADDRESS" : `FORMATS AT ${result.domain.toUpperCase()}`)
  const odds = result.known_domain ? "   " + c.badge(percent(top.confidence)) : ""
  const box = panel(
    [
      label + odds,
      "",
      top.email ? c.bold(top.email) : addressFormat(top.template, c),
      addressFormat(top.template, c),
      "",
      evidence(result, top, c),
      mailLine(result, c),
    ],
    c.leaf(" @ emailpattern "),
    c,
  )
  if (rest.length === 0) return box
  return `${box}\n\n${alternatives(rest, c, { withEmail: Boolean(top.email), title: "Other possibilities" })}`
}

/** Every format a domain uses, with shares. */
export function domainResult(result, c) {
  const problem = errorText(result, c)
  if (problem) return problem
  const header = c.bold(result.domain) + (result.company_name ? "  " + c.muted(result.company_name) : "")
  const note = result.known_domain
    ? c.muted(`Based on ${result.sample_count} people at ${result.domain}.`)
    : c.muted(`No addresses from ${result.domain} yet; these are the most common formats overall.`)
  const title = result.known_domain ? "Formats used" : "Most common formats"
  return [header, mailLine(result, c), "", alternatives(result.candidates, c, { withEmail: false, title }), "", note].join("\n")
}

export function bulkSummary({ found, known, failed, output }, c) {
  const skipped = failed ? c.muted("  ·  ") + c.warn(`${failed} ${failed === 1 ? "row" : "rows"} skipped`) : ""
  return `${c.leaf("✓ ")}${found} addresses written to ${c.bold(output)}${c.muted("  ·  ")}${c.muted(`${known} from companies we know`)}${skipped}`
}

export function progressLine(done, total, c) {
  const width = 30
  const filled = total ? Math.round((done / total) * width) : width
  return `${c.sage("Looking up")} ${c.leaf("━".repeat(filled))}${c.frame("━".repeat(width - filled))} ${c.leaf(`${done}/${total}`)}`
}
