// Code shown in the API and MCP sections. Kept as data so the home page stays markup.

import type { CodeSample } from "@/components/CodeTabs"

export function apiSamples(origin: string, name: string): CodeSample[] {
  const q = new URLSearchParams({ domain: "acme.com", name }).toString()
  return [
    {
      id: "curl",
      label: "curl",
      code: `curl "${origin}/api/v1/find?${q}"`,
    },
    {
      id: "js",
      label: "JavaScript",
      code: `const res = await fetch("${origin}/api/v1/find", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    queries: [{ domain: "acme.com", name: "${name}" }],
  }),
})
const { results } = await res.json()
console.log(results[0].candidates[0].email)`,
    },
    {
      id: "python",
      label: "Python",
      code: `# pip install emailpattern
import emailpattern

found = emailpattern.find("${name}", "acme.com")
print(found.email, found.best.confidence)`,
    },
    {
      id: "response",
      label: "Response",
      code: `{
  "domain": "acme.com",
  "known_domain": true,
  "sample_count": 41,
  "candidates": [
    { "email": "jane.doe@acme.com", "pattern": "first-dot-last",
      "template": "{first}.{last}@acme.com", "confidence": 0.86 },
    { "email": "jdoe@acme.com", "pattern": "flast",
      "template": "{f}{last}@acme.com", "confidence": 0.08 }
  ],
  "mail": { "accepts_mail": true, "host": "Google Workspace" }
}`,
    },
  ]
}

export function mcpSamples(origin: string): CodeSample[] {
  const url = `${origin}/mcp`
  return [
    {
      id: "claude-code",
      label: "Claude Code",
      code: `claude mcp add --transport http emailpattern ${url}`,
    },
    {
      id: "cursor",
      label: "Cursor",
      code: `// ~/.cursor/mcp.json
{
  "mcpServers": {
    "emailpattern": { "url": "${url}" }
  }
}`,
    },
    {
      id: "other",
      label: "Other clients",
      code: `{
  "mcpServers": {
    "emailpattern": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${url}"]
    }
  }
}`,
    },
  ]
}

export function cliSamples(name: string): CodeSample[] {
  return [
    {
      id: "install",
      label: "Install",
      code: `pipx install emailpattern            # Python, also the SDK
npm install -g @emailpattern/cli      # Node

# or run once without installing
uvx emailpattern find "${name}" acme.com
npx @emailpattern/cli find "${name}" acme.com`,
    },
    {
      id: "find",
      label: "find",
      code: `emailpattern find "${name}" acme.com
emailpattern domain acme.com`,
    },
    {
      id: "bulk",
      label: "bulk",
      code: `# a CSV with name and website columns
emailpattern bulk leads.csv -o leads-with-emails.csv`,
    },
  ]
}
