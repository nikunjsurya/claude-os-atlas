// POST /api/pulse/sites/refresh: manual force-recapture of all site shots.
// Mutating route: passes the shared guard (spec section 7).

import { checkMutatingRequest, getSessionToken, publicMode404 } from '@/lib/guard'
import { invalidateSites, readSiteConfigs } from '@/lib/collectors/registry'
import { kickCapture } from '@/lib/collectors/screenshot'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const gated = publicMode404()
  if (gated) return gated
  const verdict = checkMutatingRequest(request, getSessionToken())
  if (!verdict.ok) {
    return Response.json({ error: verdict.reason }, { status: verdict.status })
  }
  const sites = await readSiteConfigs()
  for (const site of sites) kickCapture(site, true)
  invalidateSites()
  return Response.json({ kicked: sites.map((s) => s.id) }, { status: 202 })
}
