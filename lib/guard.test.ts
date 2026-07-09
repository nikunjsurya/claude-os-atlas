import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkMutatingRequest, getSessionToken, publicMode404 } from './guard'

const TOKEN = 'test-token-123'

function req(over: {
  host?: string
  origin?: string | null
  contentType?: string
  token?: string | null
}): Request {
  const headers = new Headers()
  headers.set('host', over.host ?? '127.0.0.1:3000')
  if (over.origin !== null) {
    headers.set('origin', over.origin ?? 'http://127.0.0.1:3000')
  }
  headers.set('content-type', over.contentType ?? 'application/json')
  if (over.token !== null) {
    headers.set('x-atlas-token', over.token ?? TOKEN)
  }
  return new Request('http://127.0.0.1:3000/api/launch', {
    method: 'POST',
    headers,
    body: '{}',
  })
}

describe('checkMutatingRequest', () => {
  it('accepts a well-formed local request with the right token', () => {
    expect(checkMutatingRequest(req({}), TOKEN).ok).toBe(true)
  })

  it('rejects a non-localhost Host (DNS rebinding leg)', () => {
    const verdict = checkMutatingRequest(req({ host: 'evil.example:3000' }), TOKEN)
    expect(verdict.ok).toBe(false)
    expect(verdict.status).toBe(403)
  })

  it('rejects a cross-origin Origin while allowing absent Origin', () => {
    expect(
      checkMutatingRequest(req({ origin: 'https://evil.example' }), TOKEN).ok
    ).toBe(false)
    expect(checkMutatingRequest(req({ origin: null }), TOKEN).ok).toBe(true)
  })

  it('rejects non-JSON content types (no-preflight text/plain leg)', () => {
    expect(
      checkMutatingRequest(req({ contentType: 'text/plain' }), TOKEN).ok
    ).toBe(false)
  })

  it('rejects a missing or wrong X-Atlas-Token', () => {
    expect(checkMutatingRequest(req({ token: null }), TOKEN).ok).toBe(false)
    expect(checkMutatingRequest(req({ token: 'wrong' }), TOKEN).ok).toBe(false)
  })
})

describe('getSessionToken', () => {
  it('is stable within a boot and non-trivial', () => {
    const a = getSessionToken()
    expect(a).toBe(getSessionToken())
    expect(a.length).toBeGreaterThanOrEqual(32)
  })

  it('survives module re-instantiation (Next dev gives each route its own module graph)', async () => {
    const a = getSessionToken()
    vi.resetModules()
    const fresh = await import('./guard')
    expect(fresh.getSessionToken()).toBe(a)
  })
})

describe('publicMode404', () => {
  const original = process.env.NEXT_PUBLIC_ATLAS_MODE

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_ATLAS_MODE
    else process.env.NEXT_PUBLIC_ATLAS_MODE = original
  })

  it('returns 404 in public mode and null locally', () => {
    process.env.NEXT_PUBLIC_ATLAS_MODE = 'public'
    expect(publicMode404()?.status).toBe(404)
    delete process.env.NEXT_PUBLIC_ATLAS_MODE
    expect(publicMode404()).toBeNull()
  })
})
