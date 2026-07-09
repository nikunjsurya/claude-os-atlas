// GET /api/pulse/sites. Never blocks on capture: getSiteCards kicks
// background captures for missing/6h-stale shots and returns current cache.
// Spec: 2026-07-09-mission-control-v2-design.md sections 4.2, 5.

import { publicMode404 } from '@/lib/guard'
import { getSiteCards } from '@/lib/collectors/registry'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gated = publicMode404()
  if (gated) return gated
  try {
    return Response.json(await getSiteCards())
  } catch (err) {
    return Response.json(
      { error: `sites collector failed: ${(err as Error).message}` },
      { status: 200 }
    )
  }
}
