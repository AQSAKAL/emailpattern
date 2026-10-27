# emailpattern.com

A one-page site plus SEO pages for every company domain: type a name and a company website, get the
company's email format and the likely address. Same answers over a REST API and an MCP endpoint.

## Layout

- `src/lib/email/` — pure calculations: name parsing, domain normalising, the pattern catalogue,
  ranking (`candidates.ts`) and learning a domain's formats from known addresses (`infer.ts`). Tested in `tests/`.
- `src/server/` — effects: SQLite store (`node:sqlite`), DNS MX lookups, the shared `findEmails` service,
  MCP server, OpenAPI document. The page, `/api/v1/*` and `/mcp` all go through `findEmails`.
- `src/i18n/` — locales and one typed dictionary per language. English at the root, others under `/{code}/`.
  Adding a language: a dictionary in `dictionaries/` and an entry in `locales.ts`; `tests/i18n.test.ts`
  fails if keys or placeholders differ from English.
- `src/views/` — one Astro view per page type, taking a `locale`. `src/pages/` holds thin route files
  that pick the locale and call a view; `[lang]/…` mirrors the root routes.
- `cli/` — the `emailpattern` PyPI package: a typed Python SDK (`emailpattern.find`, `Client`, `AsyncClient`,
  dataclass results in `models.py`, HTTP only in `client.py`) and the click + rich-click command line built on it
  (`cli.py`). `cd cli && uv run pytest`. Its colours mirror the site's forest/leaf palette in `_render.py`.
- `npm/` — the same CLI for Node (`@emailpattern/cli` on npm, `npx @emailpattern/cli`; the bare name `emailpattern` was refused as too close to `email-pattern`), commander + csv-parse, no colour library; `npm test`.
  Keep its commands and output in step with `cli/`. Both publish from a `cli-v<version>` tag
  (`.github/workflows/release-cli.yml`); bump both versions together.
- `src/components/ui/` — shadcn (radix, nova style). Build UI from these. `shadcn add`/`apply` has written
  `import { cn } from "cn"` and installed an npm package `cn`; point it back at `@/lib/utils` and uninstall it.
- `src/lib/showcase.ts` — the company logos under the hero, one set per language (from `simple-icons`).
  They link to those companies' pages and are worded as examples to look up, never as customers.

## Rules

- Look: forest-green frame on a pale lime page, content on big rounded white/mint/lime panels, Figtree,
  black uppercase pill buttons, piles of tilted outlined tags (`TagPile.astro`) as decoration.
- Say that the site, API and MCP are free; the copy lives in the dictionaries.
- Keep calculations pure and tested; effects (DB, DNS, fetch) stay in `src/server/`.
- Store only each domain's pattern weights, never the sample addresses.
- Domain pages with fewer than `INDEXABLE_MIN_SAMPLES` people, or whose domain takes no mail, are `noindex` and left out of sitemaps.
- Domains with no address evidence are indexed only once released (`npm run -s release-pages -- <count>`, biggest
  registered companies first, name must match the domain), in English only, listed in `en-released-N.xml` sitemaps.
- In `.astro` files, React components take `className`, plain HTML takes `class`.

## Usage data

Requests and lookups are appended to `$DATA_DIR/usage/*.jsonl` (JSON Lines, one file per kind and UTC day).
The tooling to query them lives on the server, not in this public repo.
Event building is pure (`src/lib/usage.ts`), writing is `src/server/usage-log.ts`. Never put a query string, a person's name
or a raw IP in an event. Routes must be server-rendered (`prerender = false`) or the middleware, and so the log, never sees them.

## Commands

- `npm run dev` — dev server; an empty store fills itself from `seed/dev-samples.jsonl` (made-up `.example` companies)
- `npm test` / `npm run check` / `npm run build`
- `npm run import -- samples.jsonl` — learn formats from `{name, email, company?}` lines into `$DATA_DIR`

When starting the dev server, use background mode: `astro dev --background`
(`astro dev stop`, `astro dev status`, `astro dev logs`).

## Never in this repo

It is public. No server addresses, hostnames, DNS records, SSH keys or users, server paths, internal network
names or which provider hosts it, in code, docs, comments or commit messages. Use placeholders such as
`<your-server>`; deployment specifics live outside the repo.
