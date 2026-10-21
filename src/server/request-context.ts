import { AsyncLocalStorage } from "node:async_hooks"
import { NO_EXTRA, type RequestExtra, type Surface } from "../lib/usage"

// The request being served, visible to code deep inside it (the find service, the MCP
// route) without threading it through every call. Set by the middleware.

export interface RequestContext {
  id: string
  surface: Surface
  extra: RequestExtra
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequest<T>(id: string, surface: Surface, work: (context: RequestContext) => Promise<T>): Promise<T> {
  const context: RequestContext = { id, surface, extra: NO_EXTRA }
  return storage.run(context, () => work(context))
}

export function currentRequest(): RequestContext | undefined {
  return storage.getStore()
}

/** Adds what a route learned about the request (the MCP tool called, say) to its log row. */
export function annotateRequest(extra: Partial<RequestExtra>): void {
  const context = storage.getStore()
  if (context) context.extra = { ...context.extra, ...extra }
}
