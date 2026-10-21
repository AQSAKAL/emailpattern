// Token bucket as plain data. The middleware owns the map of buckets; this only
// decides what one request does to one bucket.

export interface Bucket {
  tokens: number
  updatedAt: number
}

export interface Limit {
  /** Requests allowed in a burst. */
  capacity: number
  /** Tokens added back per second. */
  refillPerSecond: number
}

export function take(bucket: Bucket | undefined, now: number, limit: Limit): { allowed: boolean; bucket: Bucket; retryAfterSeconds: number } {
  const previous = bucket ?? { tokens: limit.capacity, updatedAt: now }
  const elapsed = Math.max(0, now - previous.updatedAt) / 1000
  const tokens = Math.min(limit.capacity, previous.tokens + elapsed * limit.refillPerSecond)
  if (tokens >= 1) return { allowed: true, bucket: { tokens: tokens - 1, updatedAt: now }, retryAfterSeconds: 0 }
  return {
    allowed: false,
    bucket: { tokens, updatedAt: now },
    retryAfterSeconds: Math.ceil((1 - tokens) / limit.refillPerSecond),
  }
}
