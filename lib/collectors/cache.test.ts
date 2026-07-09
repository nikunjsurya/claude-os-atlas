import { describe, expect, it } from 'vitest'
import { createTtlCache } from './cache'

describe('createTtlCache', () => {
  it('serves the cached value within the TTL and refetches after expiry', async () => {
    let clock = 0
    let calls = 0
    const cache = createTtlCache(
      async () => {
        calls++
        return calls
      },
      1000,
      () => clock
    )
    expect(await cache.get()).toBe(1)
    clock = 500
    expect(await cache.get()).toBe(1)
    clock = 1500
    expect(await cache.get()).toBe(2)
    expect(calls).toBe(2)
  })

  it('keeps the last good value when a refresh throws, marking nothing', async () => {
    let clock = 0
    let shouldFail = false
    const cache = createTtlCache(
      async () => {
        if (shouldFail) throw new Error('collector down')
        return 'good'
      },
      1000,
      () => clock
    )
    expect(await cache.get()).toBe('good')
    shouldFail = true
    clock = 2000
    expect(await cache.get()).toBe('good')
  })

  it('invalidate forces the next get to refetch', async () => {
    let calls = 0
    const cache = createTtlCache(
      async () => ++calls,
      100000,
      () => 0
    )
    await cache.get()
    cache.invalidate()
    expect(await cache.get()).toBe(2)
  })
})
