# @emailpattern/cli

Find the email format any company uses, and the likely address for a person there, from your terminal.
Free, no account, no key. It calls the public API at [emailpattern.com](https://emailpattern.com).

```sh
npx @emailpattern/cli find "Jane Doe" acme.com
```

## Install

```sh
npm install -g @emailpattern/cli     # Node 20 or newer; the command is `emailpattern`
```

There is also a Python version with the same commands, and a Python SDK: `pip install emailpattern`.

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

Set `EMAILPATTERN_API` or `--api` to use another server. `NO_COLOR` turns colours off.

## From code

```js
import { Client } from "@emailpattern/cli"

const client = new Client()
const result = await client.find("acme.com", "Jane Doe")
console.log(result.candidates[0].email)
```
