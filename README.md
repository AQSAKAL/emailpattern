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

```sh
docker compose up -d --build
docker compose cp samples.jsonl app:/data/samples.jsonl
docker compose exec app npm run import -- /data/samples.jsonl
```

Point the `emailpattern.com` and `www` A/AAAA records at the box first; Caddy fetches the certificates.
