// Mutating-route guard + public-mode gating for all V2 routes.
// Loopback binding does not stop drive-by browser requests (no-preflight
// POSTs, DNS rebinding), and a forged /api/launch is remote code execution;
// every leg here is load-bearing.
// Spec: 2026-07-09-mission-control-v2-design.md sections 4.4, 7.

import crypto from 'node:crypto'

export interface GuardVerdict {
  ok: boolean
  status?: number
  reason?: string
}

// Next dev compiles each route into its own module graph, so module-level
// state here is one-per-bundle, not one-per-boot: /api/session-token and
// /api/launch would mint DIFFERENT tokens and every mutation 403s. The
// token must live on globalThis, which the whole server process shares.
const g = globalThis as { __atlasSessionToken?: string }

export function getSessionToken(): string {
  if (!g.__atlasSessionToken) {
    g.__atlasSessionToken = crypto.randomBytes(24).toString('hex')
  }
  return g.__atlasSessionToken
}

export function isPublicMode(): boolean {
  return process.env.NEXT_PUBLIC_ATLAS_MODE === 'public'
}

// Returns a 404 Response for every V2 route when running a public build,
// null otherwise. A public deploy must never expose these surfaces.
export function publicMode404(): Response | null {
  if (!isPublicMode()) return null
  return new Response('Not found', { status: 404 })
}

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

function hostnameOf(hostHeader: string): string {
  const trimmed = hostHeader.trim().toLowerCase()
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']')
    return end === -1 ? trimmed : trimmed.slice(0, end + 1)
  }
  return trimmed.split(':')[0]
}

export function checkMutatingRequest(req: Request, token: string): GuardVerdict {
  const host = hostnameOf(req.headers.get('host') ?? '')
  if (!LOCAL_HOSTNAMES.has(host)) {
    return { ok: false, status: 403, reason: 'non-local Host header' }
  }

  const origin = req.headers.get('origin')
  if (origin) {
    try {
      const parsed = new URL(origin)
      if (!LOCAL_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
        return { ok: false, status: 403, reason: 'cross-origin request' }
      }
    } catch {
      return { ok: false, status: 403, reason: 'malformed Origin header' }
    }
  }

  const contentType = (req.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (contentType !== 'application/json') {
    return { ok: false, status: 415, reason: 'content-type must be application/json' }
  }

  const presented = req.headers.get('x-atlas-token')
  if (!presented || presented !== token) {
    return { ok: false, status: 403, reason: 'missing or invalid X-Atlas-Token' }
  }

  return { ok: true }
}
