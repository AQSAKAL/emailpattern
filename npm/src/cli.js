// The `emailpattern` command. buildProgram takes its effects (client, output, files)
// as arguments so tests can run it without a network or a terminal.

import { readFile, writeFile } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import { Command } from "commander"
import { ApiError, Client, DEFAULT_API, MAX_BATCH } from "./api.js"
import { colorEnabled, palette } from "./colors.js"
import { DOMAIN_COLUMNS, NAME_COLUMNS, batches, pickColumn, readCsv, resultFields, writeCsv } from "./csv.js"
import { bulkSummary, domainResult, findResult, progressLine } from "./render.js"

const VERSION = "0.2.0"

export function defaultOutput(source) {
  return join(dirname(source), `${basename(source, extname(source))}.emails.csv`)
}

export function buildProgram({
  client,
  stdout = process.stdout,
  stderr = process.stderr,
  files = { readFile, writeFile },
  colors = palette(colorEnabled(stdout)),
} = {}) {
  const state = { exitCode: 0 }
  const errColors = colors.enabled ? palette(colorEnabled(stderr)) : colors
  const print = (text) => stdout.write(text + "\n")
  const fail = (message, code = 1) => {
    stderr.write(`${errColors.warn("✗")} ${message}\n`)
    state.exitCode = code
  }
  const getClient = (program) => client ?? new Client({ baseUrl: program.opts().api })

  const program = new Command()
    .name("emailpattern")
    .description("Find anyone's business email address.\nGive a name and a company website; get the format the company uses and the most likely address. Free, no account, no key.")
    .version(VERSION, "-V, --version")
    .helpOption("-h, --help")
    .option("--api <url>", "API base URL", process.env.EMAILPATTERN_API ?? DEFAULT_API)
    .configureOutput({ writeOut: (s) => stdout.write(s), writeErr: (s) => stderr.write(s) })
    .configureHelp({
      styleTitle: (s) => colors.sage(colors.bold(s)),
      styleCommandText: (s) => colors.leaf(s),
      styleSubcommandText: (s) => colors.leaf(s),
      styleOptionText: (s) => colors.leaf(s),
      styleArgumentText: (s) => colors.last(s),
      styleDescriptionText: (s) => s,
    })
    .showHelpAfterError()

  program
    .command("find")
    .description("Find the most likely address for NAME at DOMAIN.  e.g. emailpattern find \"Jane Doe\" acme.com")
    .argument("<name>", "the person's name")
    .argument("<domain>", "the company website or domain")
    .option("--json", "print the raw API result")
    .action(async (name, domain, opts) => {
      try {
        const result = await getClient(program).find(domain, name)
        print(opts.json ? JSON.stringify(result, null, 2) : findResult(result, colors))
        if (result.error) state.exitCode = 2
      } catch (error) {
        if (!(error instanceof ApiError)) throw error
        fail(error.message)
      }
    })

  program
    .command("domain")
    .description("Show every email format DOMAIN uses, with shares.  e.g. emailpattern domain acme.com")
    .argument("<domain>", "the company website or domain")
    .option("--json", "print the raw API result")
    .action(async (domain, opts) => {
      try {
        const result = await getClient(program).domain(domain)
        print(opts.json ? JSON.stringify(result, null, 2) : domainResult(result, colors))
        if (result.error) state.exitCode = 2
      } catch (error) {
        if (!(error instanceof ApiError)) throw error
        fail(error.message)
      }
    })

  program
    .command("bulk")
    .description("Add the likely address to every row of a CSV, 50 people per request.  e.g. emailpattern bulk leads.csv -o out.csv")
    .argument("<source>", "CSV with a name column and a website column")
    .option("-o, --output <file>", "where to write (default: SOURCE.emails.csv)")
    .option("--name-column <header>", "header of the name column (default: name, full_name, …)")
    .option("--domain-column <header>", "header of the website column (default: domain, website, …)")
    .action(async (source, opts) => {
      let text
      try {
        text = await files.readFile(source, "utf8")
      } catch {
        return fail(`Can't read ${source}.`)
      }
      const { headers, rows } = readCsv(text)
      const nameKey = pickColumn(headers, opts.nameColumn, NAME_COLUMNS)
      const domainKey = pickColumn(headers, opts.domainColumn, DOMAIN_COLUMNS)
      if (!nameKey || !domainKey) {
        return fail(`Couldn't find the name and website columns in ${basename(source)} (headers: ${headers.join(", ")}). Use --name-column and --domain-column.`)
      }

      const api = getClient(program)
      const counts = { found: 0, known: 0, failed: 0 }
      const live = Boolean(stderr.isTTY)
      let done = 0
      for (const chunk of batches(rows, MAX_BATCH)) {
        let results
        try {
          results = await api.findMany(chunk.map((r) => ({ domain: r[domainKey] ?? "", name: r[nameKey] ?? "" })))
        } catch (error) {
          if (!(error instanceof ApiError)) throw error
          if (live) stderr.write("\n")
          return fail(error.message)
        }
        chunk.forEach((row, i) => {
          const fields = resultFields(results[i])
          Object.assign(row, fields)
          counts.found += fields.email ? 1 : 0
          counts.known += fields.known_domain === "yes" ? 1 : 0
          counts.failed += fields.error ? 1 : 0
        })
        done += chunk.length
        if (live) stderr.write(`\r${progressLine(done, rows.length, errColors)}`)
      }
      if (live) stderr.write("\r\x1b[2K")

      const output = opts.output ?? defaultOutput(source)
      await files.writeFile(output, writeCsv(headers, rows), "utf8")
      print(bulkSummary({ ...counts, output }, colors))
    })

  return { program, state }
}

export async function run(argv = process.argv) {
  const { program, state } = buildProgram()
  await program.parseAsync(argv)
  process.exitCode = state.exitCode
}
