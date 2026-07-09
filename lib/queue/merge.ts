// Curated + derived queue merge with suppression semantics. Pure.
// A suppression hides a derived item only while BOTH id and stateKey match,
// and is pruned once the id leaves the derivation, so it can never outlive
// the incident it silenced.
// Spec: 2026-07-09-mission-control-v2-design.md section 5.

import type {
  DerivedQueueItem,
  QueueItem,
  QueueState,
} from '@/lib/types'

export interface MergedQueue {
  items: QueueItem[]
  prunedState: QueueState
}

export function mergeQueue(
  curated: QueueItem[],
  derived: DerivedQueueItem[],
  state: QueueState
): MergedQueue {
  const curatedIds = new Set(curated.map((c) => c.id))
  const derivedIds = new Set(derived.map((d) => d.id))

  const suppressed = state.suppressed.filter((s) => derivedIds.has(s.id))
  const isSuppressed = (d: DerivedQueueItem): boolean =>
    suppressed.some((s) => s.id === d.id && s.stateKey === d.stateKey)

  const items: QueueItem[] = []

  for (const c of curated) {
    items.push({ ...c, status: state.statusOverrides[c.id] ?? c.status })
  }

  for (const d of derived) {
    if (curatedIds.has(d.id)) continue
    if (isSuppressed(d)) continue
    const { stateKey: _stateKey, ...item } = d
    items.push({ ...item, status: state.statusOverrides[d.id] ?? item.status })
  }

  return {
    items,
    prunedState: { statusOverrides: state.statusOverrides, suppressed },
  }
}
