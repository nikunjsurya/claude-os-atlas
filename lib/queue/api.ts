// Queue route logic, extracted from the route handlers so it can be
// integration-tested against fixture directories with a stubbed derivation.
// Spec: 2026-07-09-mission-control-v2-design.md sections 4.2, 5.

import type {
  DerivedQueueItem,
  QueueItem,
  QueueStatus,
} from '@/lib/types'
import { mergeQueue } from './merge'
import { EMPTY_STATE, readCurated, readState, writeState } from './store'

export interface QueueDeps {
  queueFile: string
  queueStateFile: string
  deriveCurrent: () => Promise<DerivedQueueItem[]>
}

export interface QueueResponseBody {
  items: QueueItem[]
  warnings: string[]
}

const VALID_STATUSES: QueueStatus[] = ['open', 'done', 'dismissed']
const DERIVED_PREFIXES = ['n8n:', 'site:', 'git:']

function isDerivedId(id: string): boolean {
  return DERIVED_PREFIXES.some((p) => id.startsWith(p))
}

export async function buildQueueResponse(
  deps: QueueDeps
): Promise<QueueResponseBody> {
  const [curated, state, derived] = await Promise.all([
    readCurated(deps.queueFile),
    readState(deps.queueStateFile),
    deps.deriveCurrent(),
  ])
  const { items, prunedState } = mergeQueue(curated.value, derived, state.value)
  if (JSON.stringify(prunedState) !== JSON.stringify(state.value)) {
    await writeState(deps.queueStateFile, prunedState)
  }
  return {
    items,
    warnings: [curated.warning, state.warning].filter(
      (w): w is string => w !== null
    ),
  }
}

export interface PatchResult {
  ok: boolean
  status: number
  error?: string
}

export async function applyQueuePatch(
  deps: QueueDeps,
  id: string,
  status: unknown
): Promise<PatchResult> {
  if (
    typeof status !== 'string' ||
    !VALID_STATUSES.includes(status as QueueStatus)
  ) {
    return { ok: false, status: 400, error: 'status must be open|done|dismissed' }
  }
  const nextStatus = status as QueueStatus
  const state = (await readState(deps.queueStateFile)).value ?? EMPTY_STATE

  if (isDerivedId(id)) {
    if (nextStatus === 'open') {
      state.suppressed = state.suppressed.filter((s) => s.id !== id)
      delete state.statusOverrides[id]
    } else {
      const derived = await deps.deriveCurrent()
      const item = derived.find((d) => d.id === id)
      if (!item) {
        return { ok: false, status: 404, error: 'item is not currently derived' }
      }
      state.suppressed = state.suppressed
        .filter((s) => s.id !== id)
        .concat([{ id, stateKey: item.stateKey }])
    }
  } else {
    if (nextStatus === 'open') delete state.statusOverrides[id]
    else state.statusOverrides[id] = nextStatus
  }

  await writeState(deps.queueStateFile, state)
  return { ok: true, status: 200 }
}
