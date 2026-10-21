import { describe, expect, it } from "vitest"
import { take } from "../src/lib/rate-limit"

describe("take", () => {
  const limit = { capacity: 2, refillPerSecond: 1 }

  it("allows a burst up to capacity, then refuses", () => {
    let bucket = take(undefined, 0, limit).bucket
    const second = take(bucket, 0, limit)
    expect(second.allowed).toBe(true)
    bucket = second.bucket
    const third = take(bucket, 0, limit)
    expect(third.allowed).toBe(false)
    expect(third.retryAfterSeconds).toBe(1)
  })

  it("refills over time without exceeding capacity", () => {
    const empty = { tokens: 0, updatedAt: 0 }
    expect(take(empty, 1000, limit).allowed).toBe(true)
    expect(take(empty, 60_000, limit).bucket.tokens).toBe(1)
  })
})
