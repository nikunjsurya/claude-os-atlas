import { beforeEach, describe, expect, it, vi } from 'vitest'

// The helper caches the token in module state, so every test gets a fresh
// module instance via resetModules + dynamic import (same pattern as guard).
async function freshMutate() {
  vi.resetModules()
  const mod = await import('./clientMutate')
  return mod.mutateJson
}

function tokenResponse(token: string): Response {
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('mutateJson', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches the session token, then sends it with the JSON body', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url === '/api/session-token') return Promise.resolve(tokenResponse('tok-1'))
      return Promise.resolve(new Response('{}', { status: 200 }))
    })
    const mutateJson = await freshMutate()

    const res = await mutateJson('/api/launch', { a: 1 })

    expect(res?.status).toBe(200)
    expect(calls[0].url).toBe('/api/session-token')
    expect(calls[1].url).toBe('/api/launch')
    const headers = calls[1].init?.headers as Record<string, string>
    expect(headers['X-Atlas-Token']).toBe('tok-1')
    expect(headers['Content-Type']).toBe('application/json')
    expect(calls[1].init?.body).toBe(JSON.stringify({ a: 1 }))
    expect(calls[1].init?.method).toBe('POST')
  })

  it('reuses the cached token on later calls', async () => {
    let tokenFetches = 0
    vi.stubGlobal('fetch', (url: string) => {
      if (url === '/api/session-token') {
        tokenFetches++
        return Promise.resolve(tokenResponse('tok-1'))
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    })
    const mutateJson = await freshMutate()

    await mutateJson('/api/queue/x', { status: 'done' }, 'PATCH')
    await mutateJson('/api/queue/y', { status: 'done' }, 'PATCH')

    expect(tokenFetches).toBe(1)
  })

  it('supports PATCH via the method argument', async () => {
    let method: string | undefined
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      if (url === '/api/session-token') return Promise.resolve(tokenResponse('tok-1'))
      method = init?.method
      return Promise.resolve(new Response('{}', { status: 200 }))
    })
    const mutateJson = await freshMutate()

    await mutateJson('/api/queue/x', {}, 'PATCH')

    expect(method).toBe('PATCH')
  })

  it('on 403 refetches the token and retries exactly once', async () => {
    const tokens = ['stale', 'fresh']
    const seen: string[] = []
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      if (url === '/api/session-token') {
        return Promise.resolve(tokenResponse(tokens.shift() ?? 'exhausted'))
      }
      const sent = (init?.headers as Record<string, string>)['X-Atlas-Token']
      seen.push(sent)
      return Promise.resolve(
        new Response('{}', { status: sent === 'fresh' ? 200 : 403 })
      )
    })
    const mutateJson = await freshMutate()

    const res = await mutateJson('/api/launch', {})

    expect(res?.status).toBe(200)
    expect(seen).toEqual(['stale', 'fresh'])
  })

  it('returns the 403 when the retry also fails, without looping', async () => {
    let attempts = 0
    vi.stubGlobal('fetch', (url: string) => {
      if (url === '/api/session-token') return Promise.resolve(tokenResponse('bad'))
      attempts++
      return Promise.resolve(new Response('{}', { status: 403 }))
    })
    const mutateJson = await freshMutate()

    const res = await mutateJson('/api/launch', {})

    expect(res?.status).toBe(403)
    expect(attempts).toBe(2)
  })

  it('returns null on network failure instead of throwing', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('ECONNREFUSED')))
    const mutateJson = await freshMutate()

    const res = await mutateJson('/api/launch', {})

    expect(res).toBeNull()
  })
})
