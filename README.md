# emailpattern.com

Find the email format any company uses, and the likely address for a person there.
Astro (Node adapter) + React islands + shadcn, SQLite for the learned formats.

See [AGENTS.md](AGENTS.md) for the code layout and rules.

## Develop

```sh
npm install
npm run dev        # http://localhost:4321, seeded with made-up .example companies
npm test
npm run check
```

## Surfaces

| URL | What |
| --- | --- |
| `/` and `/{de,fr,es}/` | One-pager with the finder |
| `/{domain}` | A company's formats (SEO page), e.g. `/acme.com`, `/de/acme.com` |
| `/patterns`, `/patterns/{id}` | Every format, examples, spreadsheet formula |
| `/browse/{a-z0-9}` | Crawl hubs |
| `/sitemap.xml` | Index of per-language sitemaps, 40k domains each |
| `/api/v1/find` | GET one lookup, POST up to 50 |
| `/api/v1/domains/{domain}` | A domain's formats |
| `/api/openapi.json` | OpenAPI 3.1 |
| `/mcp` | MCP (streamable HTTP): `find_email`, `get_email_patterns` |
| `/llms.txt` | Summary for AI agents |

## Data

The store learns formats from JSON Lines of `{"name": "Jane Doe", "email": "jane.doe@acme.com", "company": "Acme"}`.
Only the per-domain pattern weights are kept.

```sh
npm run import -- path/to/samples.jsonl
```

## Deploy 

Runs on the host box as a side project, like the other sites there: a Compose project in
`<app-dir>` attached to the host stack's `<proxy-network>` network. The host's Caddy
(`deployment/Caddyfile` in the host repo) holds the `emailpattern.com` block, fetches the
certificates and proxies to `emailpattern-web:4321`.

```sh
# first time
git clone https://github.com/AQSAKAL/emailpattern.git <app-dir>
# every release
cd <app-dir> && git pull && docker compose up -d --build
# load samples
docker compose cp samples.jsonl emailpattern-web:/data/samples.jsonl
docker compose exec emailpattern-web npm run import -- /data/samples.jsonl
```

DNS (<dns-provider>): `A @ → <server-ip>`, `CNAME www → emailpattern.com.`
