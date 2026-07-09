// GET /api/atlas. Spec section 5.4: never returns 500 unless this handler
// itself crashes. Returns 200 with partial result + warnings[] on parser
// errors. In public mode the route serves the sanitized snapshot, the
// live filesystem is not available on the host.

import path from 'node:path'
import fs from 'node:fs/promises'
import { getAtlasCached } from '@/lib/atlasCache'

export const dynamic = 'force-dynamic'

const PUBLIC_MODE = process.env.NEXT_PUBLIC_ATLAS_MODE === 'public'

export async function GET() {
  try {
    if (PUBLIC_MODE) {
      const snapshotPath = path.join(process.cwd(), 'data', 'atlas-snapshot.json')
      const raw = await fs.readFile(snapshotPath, 'utf8')
      return new Response(raw, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return Response.json(await getAtlasCached())
  } catch (err) {
    return Response.json(
      {
        nodes: [],
        edges: [],
        clusters: [],
        stats: { nodes: 0, edges: 0, active: 0, parked: 0, shipped: 0, skills: 0 },
        generatedAt: new Date().toISOString(),
        warnings: [
          `route handler crashed: ${(err as Error).message}`,
        ],
      },
      { status: 200 }
    )
  }
}
