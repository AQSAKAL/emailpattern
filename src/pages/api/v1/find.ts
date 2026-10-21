import type { APIRoute } from "astro"
import { z } from "zod"
import { MAX_BATCH, findEmails } from "@/server/find"
import { json } from "@/server/http"

export const prerender = false

const Query = z.object({ domain: z.string().min(1).max(253), name: z.string().max(200).optional() })
const Batch = z.object({ queries: z.array(Query).min(1).max(MAX_BATCH) })

/** GET /api/v1/find?domain=acme.com&name=Jane%20Doe — one lookup. */
export const GET: APIRoute = async ({ url }) => {
  const parsed = Query.safeParse({ domain: url.searchParams.get("domain") ?? "", name: url.searchParams.get("name") ?? undefined })
  if (!parsed.success) return json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 })
  const [result] = await findEmails([parsed.data])
  return json(result, { status: result.error ? 422 : 200 })
}

/** POST /api/v1/find {"queries": [{domain, name}, …]} — up to 50 lookups. */
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null)
  const parsed = Batch.safeParse(body)
  if (!parsed.success) return json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 })
  return json({ results: await findEmails(parsed.data.queries) })
}
