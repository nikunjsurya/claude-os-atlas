// GET /api/pulse/n8n. Read-only heartbeat; the API key never reaches the
// browser. Spec: 2026-07-09-mission-control-v2-design.md sections 4.2, 5.

import { publicMode404 } from '@/lib/guard'
import { getN8nPulse } from '@/lib/collectors/registry'
import { unreachablePulse } from '@/lib/collectors/n8n'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gated = publicMode404()
  if (gated) return gated
  try {
    return Response.json(await getN8nPulse())
  } catch {
    return Response.json(unreachablePulse())
  }
}
