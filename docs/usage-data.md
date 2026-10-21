# Usage data

Every request the app serves (pages, `/api/v1/*`, `/mcp`, `robots.txt`, sitemaps, `llms.txt`) and every
company lookup is appended to JSON Lines files under `$DATA_DIR/usage/`, one file per kind and UTC day:

```
usage/requests-2026-10-21.jsonl     one row per request
usage/lookups-2026-10-21.jsonl      one row per company lookup (API, MCP)
```

There is no dashboard. You query the files with DuckDB.

## What is in a row

`requests`

| Column | Meaning |
| --- | --- |
| `ts`, `id` | UTC time; random id that `lookups.request_id` points to |
| `method`, `path`, `status`, `ms` | The request. `path` has no query string. |
| `surface` | `page`, `api`, `mcp`, `api_doc` (openapi), `seo_file` (robots, sitemaps, llms.txt) |
| `lang`, `route`, `domain` | Language, the page type with ids replaced (`/[domain]`, `/patterns/[id]`, `/browse/[letter]`, `/[other]` for 404s), and the company domain when the URL names one |
| `ip_hash` | Keyed hash of the caller's IP: the same caller keeps the same hash, the address is not stored |
| `ua`, `agent`, `agent_kind` | User-agent, its family (Chrome, curl, Googlebot, ClaudeBot, python…) and kind: `browser`, `library`, `crawler`, `ai_crawler`, `ai_agent`, `unknown` |
| `referrer_host` | Host of the referring page |
| `rpc_method`, `tool`, `client`, `client_version` | MCP only: the JSON-RPC method, the tool called, and the client named in `initialize` |

`lookups`

| Column | Meaning |
| --- | --- |
| `ts`, `request_id`, `surface` | When, which request (`requests.id`), and `api` or `mcp` |
| `domain` | Normalised company domain; null when the input was not a domain |
| `known_domain`, `sample_count` | Whether we hold that company's formats, and from how many people |
| `has_name` | Whether a person's name was given. The name itself is never stored. |
| `top_pattern`, `top_confidence`, `candidates` | The best answer and how many were returned |
| `error`, `accepts_mail` | `invalid_domain` / `invalid_name`, and whether the domain has a mail server |

Not stored: query strings, names, raw IPs.

## Open it

Fetch the logs from the server (the data volume is `emailpattern_data`) and start DuckDB next to them:

```sh
mkdir -p ~/emailpattern-usage && cd ~/emailpattern-usage
rsync -az -e "ssh -i ~/.ssh/<ssh-key> -o IdentitiesOnly=yes" \
  <user>@<server>:<data-volume>/usage/ ./usage/
duckdb -init ~/emailpattern/scripts/usage.sql
```

That gives you the views `requests` and `lookups`. On a development machine the files are in `./data/usage`, so
`cd data && duckdb -init ../scripts/usage.sql`.

## Queries

```sql
-- requests and distinct callers per day and surface
SELECT date_trunc('day', ts) AS day, surface, count(*) AS requests, count(DISTINCT ip_hash) AS callers
FROM requests GROUP BY ALL ORDER BY 1, 2;

-- heaviest callers
SELECT ip_hash, arg_max(agent, ts) AS agent, count(*) AS requests, min(ts) AS first_seen, max(ts) AS last_seen
FROM requests GROUP BY ip_hash ORDER BY requests DESC LIMIT 20;

-- most searched companies
SELECT domain, count(*) AS searches, bool_or(known_domain) AS known
FROM lookups WHERE domain IS NOT NULL GROUP BY domain ORDER BY searches DESC LIMIT 50;

-- MCP: who connects and what they call
SELECT client, client_version, tool, count(*) AS requests
FROM requests WHERE surface = 'mcp' GROUP BY ALL ORDER BY requests DESC;

-- search engines and AI crawlers, per day and language
SELECT date_trunc('day', ts) AS day, agent, lang, count(*) AS hits
FROM requests WHERE agent_kind IN ('crawler', 'ai_crawler', 'ai_agent') GROUP BY ALL ORDER BY 1, 4 DESC;

-- latency and errors by route
SELECT surface, route, count(*) AS n,
       round(quantile_cont(ms, 0.5), 1) AS p50, round(quantile_cont(ms, 0.95), 1) AS p95,
       count(*) FILTER (WHERE status >= 400) AS errors
FROM requests GROUP BY ALL ORDER BY n DESC;

-- where visitors come from
SELECT referrer_host, count(*) AS n FROM requests
WHERE referrer_host IS NOT NULL AND surface = 'page' GROUP BY 1 ORDER BY 2 DESC LIMIT 30;

-- who asked for what
SELECT l.ts, l.domain, l.known_domain, r.agent, r.client, r.ip_hash
FROM lookups l JOIN requests r ON r.id = l.request_id ORDER BY l.ts DESC LIMIT 100;
```

### What to import next

Companies people look for that we hold nothing on. Needs a copy of the store next to the logs
(copy `emailpattern.sqlite`, `-wal` and `-shm` together):

```sql
ATTACH 'emailpattern.sqlite' AS store (TYPE sqlite, READ_ONLY);

WITH asked AS (
  SELECT domain, count(*) AS hits FROM (
    SELECT domain FROM requests WHERE route = '/[domain]' AND status = 200
    UNION ALL
    SELECT domain FROM lookups WHERE domain IS NOT NULL
  ) GROUP BY domain
)
SELECT a.domain, a.hits
FROM asked a LEFT JOIN store.domains d USING (domain)
WHERE d.domain IS NULL ORDER BY a.hits DESC LIMIT 100;
```

## Keeping it small

A request row is about 350 bytes, so 100,000 requests a day is roughly 35 MB. Turn old days into Parquet and delete the JSON:

```sql
COPY (SELECT * FROM requests WHERE ts < now() - INTERVAL 90 DAY) TO 'requests-archive.parquet';
```

## Settings

| Variable | Default | |
| --- | --- | --- |
| `DATA_DIR` | `./data` (`/data` in the container) | Where `usage/` lives |
| `USAGE_LOG` | on | `off` stops all logging |
| `USAGE_SECRET` | random, kept in `$DATA_DIR/usage.secret` | Key for `ip_hash`. Change it and old hashes no longer match new ones. |

Events are buffered and written once a second, and flushed on SIGTERM. If the disk stalls the buffer caps at
20,000 events and drops new ones rather than slowing requests.
