export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...init.headers },
  })
}

export function xml(body: string, cache: string): Response {
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": cache } })
}
