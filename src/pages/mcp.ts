import type { APIRoute } from "astro"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { buildMcpServer } from "@/server/mcp"

export const prerender = false

// Stateless streamable HTTP: a fresh server per request, no sessions to keep.
export const ALL: APIRoute = async ({ request }) => {
  const server = buildMcpServer()
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  return transport.handleRequest(request)
}
