import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { MAX_BATCH, findEmails } from "./find"

// Bulk by default: every tool takes a list, so an agent sends one call for a whole list of people.

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "emailpattern", version: "1.0.0" })

  server.registerTool(
    "find_email",
    {
      title: "Find email addresses",
      description:
        "For each person (name + company website), returns the most likely work email address and the alternatives, " +
        "each with a confidence between 0 and 1. known_domain=false means we have no data for that company and the " +
        "ranking is the global default. Addresses are inferred from the company's format, not verified.",
      inputSchema: {
        people: z
          .array(z.object({ name: z.string().describe("Full name, e.g. 'Jane Doe'"), domain: z.string().describe("Company website or domain, e.g. 'acme.com'") }))
          .min(1)
          .max(MAX_BATCH),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ people }) => {
      const results = await findEmails(people)
      return { content: [{ type: "text", text: JSON.stringify({ results }) }] }
    },
  )

  server.registerTool(
    "get_email_patterns",
    {
      title: "Get company email formats",
      description:
        "For each company domain, returns the email formats its people use (e.g. {first}.{last}) with their shares, " +
        "and whether the domain receives email.",
      inputSchema: { domains: z.array(z.string()).min(1).max(MAX_BATCH) },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ domains }) => {
      const results = await findEmails(domains.map((domain) => ({ domain })), 15)
      return { content: [{ type: "text", text: JSON.stringify({ results }) }] }
    },
  )

  return server
}
