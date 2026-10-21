// HTTP calls to the public API. The only module that talks to the network.
// Also the package's programmatic entry: import { Client } from "emailpattern".

export const DEFAULT_API = "https://emailpattern.com"
export const MAX_BATCH = 50
const VERSION = "0.1.0"

export class ApiError extends Error {}

export class RateLimited extends ApiError {
  constructor(retryAfter) {
    super(`Too many lookups. Try again in ${retryAfter} s.`)
    this.retryAfter = retryAfter
  }
}

export class Client {
  /** @param {{ baseUrl?: string, fetch?: typeof fetch, sleep?: (ms: number) => Promise<void> }} options */
  constructor({ baseUrl = DEFAULT_API, fetch: fetchImpl = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.fetch = fetchImpl
    this.sleep = sleep
  }

  /** The most likely address for one person (or just the formats when name is empty). */
  async find(domain, name) {
    const params = new URLSearchParams({ domain, ...(name ? { name } : {}) })
    return this.#json(await this.#request(`/api/v1/find?${params}`), { allowInputErrors: true })
  }

  /** Every format a domain uses. */
  async domain(domain) {
    return this.#json(await this.#request(`/api/v1/domains/${encodeURIComponent(domain)}`), { allowInputErrors: true })
  }

  /** Up to MAX_BATCH lookups in one request; waits out rate limits a few times. */
  async findMany(queries, retries = 3) {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await this.#request("/api/v1/find", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ queries }),
        })
        return (await this.#json(response)).results
      } catch (error) {
        if (!(error instanceof RateLimited) || attempt >= retries) throw error
        await this.sleep(error.retryAfter * 1000)
      }
    }
  }

  async #request(path, init = {}) {
    try {
      return await this.fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { "user-agent": `emailpattern-npm/${VERSION}`, ...init.headers },
        signal: AbortSignal.timeout(20_000),
      })
    } catch (error) {
      throw new ApiError(`Couldn't reach ${this.baseUrl} (${error.cause?.code ?? error.message}).`)
    }
  }

  async #json(response, { allowInputErrors = false } = {}) {
    if (response.status === 429) throw new RateLimited(Number(response.headers.get("retry-after") ?? 60))
    // 422 carries a normal result whose `error` field says what was wrong with the input.
    if (!response.ok && !(allowInputErrors && response.status === 422)) throw new ApiError(`The API answered ${response.status}.`)
    return response.json()
  }
}
