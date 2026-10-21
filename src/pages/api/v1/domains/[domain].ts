import type { APIRoute } from "astro"
import { findEmails } from "@/server/find"
import { json } from "@/server/http"

export const prerender = false

/** GET /api/v1/domains/acme.com — every format the domain uses, with shares. */
export const GET: APIRoute = async ({ params }) => {
  const [result] = await findEmails([{ domain: params.domain ?? "" }], 15)
  return json(result, { status: result.error ? 422 : 200 })
}
