# emailpattern CLI

Find the email format any company uses, and the likely address for a person there, from your terminal.
Free, no account, no key. It calls the public API at [emailpattern.com](https://emailpattern.com).

## Install

```sh
uv tool install "git+https://github.com/AQSAKAL/emailpattern#subdirectory=cli"
# or: pipx install "git+https://github.com/AQSAKAL/emailpattern#subdirectory=cli"
```

## Use

```sh
emailpattern find "Jane Doe" acme.com      # the most likely address, the format and the odds
emailpattern domain acme.com               # every format the company uses
emailpattern bulk leads.csv -o out.csv     # add an email column to a CSV (name + website columns)
emailpattern find "Jane Doe" acme.com --json
```

`bulk` finds the name and website columns by their headers (`name`, `full_name`, `domain`, `website`, …);
pass `--name-column` / `--domain-column` when yours are called something else. It sends 50 people per
request and waits when it hits the rate limit (60 requests a minute).

Set `EMAILPATTERN_API` or `--api` to use another server, e.g. a local one at `http://localhost:4321`.

## Develop

```sh
uv sync
uv run pytest
uv run emailpattern --help
```
