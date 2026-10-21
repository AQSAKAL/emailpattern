import type { APIRoute } from "astro"

// Not prerendered, so the usage log sees AI agents fetching it.
export const prerender = false

export const GET: APIRoute = ({ site }) => {
  const origin = site!.origin
  return new Response(
    `# EmailPattern

> The email address format a company uses ({first}.{last}, {f}{last}, …) and the most likely address for a person there.

Answers are inferred from each company's format, with a confidence between 0 and 1. They are not verified mailboxes.

## MCP

- Endpoint: ${origin}/mcp (streamable HTTP, no auth)
- Tools: find_email(people: [{name, domain}]), get_email_patterns(domains: [string]); up to 50 items per call

## REST API

- GET ${origin}/api/v1/find?domain=acme.com&name=Jane%20Doe
- POST ${origin}/api/v1/find  {"queries": [{"domain": "acme.com", "name": "Jane Doe"}]}
- GET ${origin}/api/v1/domains/acme.com
- OpenAPI: ${origin}/api/openapi.json

## CLI

- uv tool install "git+https://github.com/AQSAKAL/emailpattern#subdirectory=cli"
- emailpattern find "Jane Doe" acme.com · emailpattern domain acme.com · emailpattern bulk leads.csv

## Pages

- ${origin}/{domain} — a company's formats, e.g. ${origin}/acme.com
- ${origin}/patterns — every format
`,
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  )
}
