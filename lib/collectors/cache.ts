// Per-collector in-memory TTL cache so client polling never hammers
// n8n/git/Chrome. Keeps the last good value when a refresh throws.
// Spec: 2026-07-09-mission-control-v2-design.md sections 4.2, 9.

export interface TtlCache<T> {
  get(): Promise<T>
  invalidate(): void
}

export function createTtlCache<T>(
  fn: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now
): TtlCache<T> {
  let value: T
  let fetchedAt: number | null = null
  let inflight: Promise<T> | null = null

  function refresh(): Promise<T> {
    if (!inflight) {
      inflight = fn()
        .then((v) => {
          value = v
          fetchedAt = now()
          return v
        })
        .finally(() => {
          inflight = null
        })
    }
    return inflight
  }

  return {
    async get(): Promise<T> {
      if (fetchedAt !== null && now() - fetchedAt < ttlMs) return value
      try {
        return await refresh()
      } catch (err) {
        if (fetchedAt !== null) return value // keep last good
        throw err
      }
    },
    invalidate(): void {
      fetchedAt = null
    },
  }
}
