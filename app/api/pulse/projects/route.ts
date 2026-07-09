// GET /api/pulse/projects. Git state of every repo under ~/Projects plus
// data/projects-extra.json. Spec: 2026-07-09-mission-control-v2-design.md
// sections 4.2, 5.

import { publicMode404 } from '@/lib/guard'
import { getProjectPulses } from '@/lib/collectors/registry'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gated = publicMode404()
  if (gated) return gated
  try {
    return Response.json(await getProjectPulses())
  } catch {
    return Response.json([])
  }
}
