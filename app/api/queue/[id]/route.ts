// PATCH /api/queue/[id]: {status: open|done|dismissed}. Mutating route,
// passes the shared guard; writes only data/queue-state.json.
// Spec: 2026-07-09-mission-control-v2-design.md sections 4.2, 5, 7.

import { checkMutatingRequest, getSessionToken, publicMode404 } from '@/lib/guard'
import { queueFile, queueStateFile } from '@/lib/dataDir'
import { applyQueuePatch } from '@/lib/queue/api'
import { deriveQueueItems } from '@/lib/queue/derive'
import { deriveInputsNow } from '@/lib/collectors/registry'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gated = publicMode404()
  if (gated) return gated
  const verdict = checkMutatingRequest(request, getSessionToken())
  if (!verdict.ok) {
    return Response.json({ error: verdict.reason }, { status: verdict.status })
  }
  const { id } = await params
  const body = (await request.json().catch(() => null)) as {
    status?: unknown
  } | null
  const result = await applyQueuePatch(
    {
      queueFile: queueFile(),
      queueStateFile: queueStateFile(),
      deriveCurrent: async () => deriveQueueItems(await deriveInputsNow()),
    },
    id,
    body?.status
  )
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }
  return Response.json({ ok: true })
}
