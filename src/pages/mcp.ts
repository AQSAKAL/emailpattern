import type { APIRoute } from "astro"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { describeRpc } from "@/lib/usage"
import { buildMcpServer } from "@/server/mcp"
import { annotateRequest } from "@/server/request-context"

export const prerender = false

// Stateless streamable HTTP: a fresh server per request, no sessions to keep.
export const ALL: APIRoute = async ({ request }) => {
  // For the usage log: which client connected and which tool it called.
  annotateRequest(describeRpc(await request.clone().json().catch(() => null)))

  const server = buildMcpServer()
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  return transport.handleRequest(request)
}
