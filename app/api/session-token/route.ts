// GET /api/session-token: per-boot random token for the mutating-route
// guard. Same-origin policy makes the response unreadable cross-origin;
// the Host check blocks DNS-rebinding token fetches.
// Spec: 2026-07-09-mission-control-v2-design.md section 7.

import { getSessionToken, publicMode404 } from '@/lib/guard'

export const dynamic = 'force-dynamic'

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

export async function GET(request: Request) {
  const gated = publicMode404()
  if (gated) return gated
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()
  if (!LOCAL_HOSTNAMES.has(host)) {
    return Response.json({ error: 'non-local Host header' }, { status: 403 })
  }
  return Response.json({ token: getSessionToken() })
}
