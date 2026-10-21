import type { APIRoute } from "astro"
import { json } from "@/server/http"
import { openApiDocument } from "@/server/openapi"

export const prerender = false

export const GET: APIRoute = ({ site }) => json(openApiDocument(site!.origin))
