// GET /api/queue: curated (data/queue.json) merged with the current
// derivation. GET only; curated items are hand-edited in the file.
// Spec: 2026-07-09-mission-control-v2-design.md sections 4.2, 5.

import { publicMode404 } from '@/lib/guard'
import { queueFile, queueStateFile } from '@/lib/dataDir'
import { buildQueueResponse } from '@/lib/queue/api'
import { deriveQueueItems } from '@/lib/queue/derive'
import { deriveInputsNow } from '@/lib/collectors/registry'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gated = publicMode404()
  if (gated) return gated
  try {
    const body = await buildQueueResponse({
      queueFile: queueFile(),
      queueStateFile: queueStateFile(),
      deriveCurrent: async () => deriveQueueItems(await deriveInputsNow()),
    })
    return Response.json(body)
  } catch (err) {
    return Response.json(
      { items: [], warnings: [`queue route crashed: ${(err as Error).message}`] },
      { status: 200 }
    )
  }
}
