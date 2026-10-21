# emailpattern

Find the email format any company uses, and the likely address for a person there.
A typed Python SDK and a command line in one package. Free, no account, no key; it calls the
public API at [emailpattern.com](https://emailpattern.com).

```sh
pip install emailpattern
```

## Python

```python
import emailpattern

found = emailpattern.find("Jane Doe", "acme.com")
found.email                 # "jane.doe@acme.com"
found.best.confidence       # 0.91 — share of the company's people using this format
found.known_domain          # False when the ranking is the global default
found.mail.accepts_mail     # whether the domain has a mail server

emailpattern.domain("acme.com").best.template   # "{first}.{last}@acme.com"
```

For several lookups, reuse a client. `find_many` takes any number of people, sends them 50 per
request and waits out the rate limit (60 requests a minute):

```python
from emailpattern import Client

with Client() as ep:
    for result in ep.find_many([("Jane Doe", "acme.com"), {"name": "Max Mustermann", "domain": "firma.de"}]):
        print(result.email if result.ok else result.error)
```

`AsyncClient` has the same methods for asyncio:

```python
from emailpattern import AsyncClient

async with AsyncClient() as ep:
    result = await ep.find("Jane Doe", "acme.com")
```

Results are frozen dataclasses (`FindResult`, `Candidate`, `Mail`) with the API's JSON in `.raw`.
Bad input (`"nope"` as a domain) comes back as a result with `error` set, not an exception;
`ApiError` / `RateLimited` are raised only when the API itself can't answer.

## Command line

```sh
pipx install emailpattern        # or: uv tool install emailpattern
uvx emailpattern find "Jane Doe" acme.com   # run once without installing

emailpattern find "Jane Doe" acme.com      # the most likely address, the format and the odds
emailpattern domain acme.com               # every format the company uses
emailpattern bulk leads.csv -o out.csv     # add an email column to a CSV (name + website columns)
emailpattern find "Jane Doe" acme.com --json
```

`bulk` finds the name and website columns by their headers (`name`, `full_name`, `domain`, `website`, …);
pass `--name-column` / `--domain-column` when yours are called something else.

Set `EMAILPATTERN_API` or `--api` (CLI) / `Client(base_url=...)` (SDK) to use another server.

There is also an npm version of the command line: `npx emailpattern find "Jane Doe" acme.com`.

## Develop

```sh
uv sync
uv run pytest
uv run emailpattern --help
```

## Release

Bump `version` here, `__version__` in `src/emailpattern/__init__.py` and the version in
`../npm/package.json`, then push a `cli-v<version>` tag; the `release-cli` workflow builds and
publishes both packages.
