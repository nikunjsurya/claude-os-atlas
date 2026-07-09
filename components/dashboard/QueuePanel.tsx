// Pending-work queue: what is waiting on Surya, grouped open-first.

'use client'

import type { QueueItem } from '@/lib/types'

const KIND_LABEL: Record<QueueItem['kind'], string> = {
  incident: 'incident',
  'owner-action': 'owner action',
  'claude-task': 'claude task',
}

export default function QueuePanel({
  items,
  onSelect,
}: {
  items: QueueItem[] | null
  onSelect: (item: QueueItem) => void
}) {
  if (!items) return <div className="text-sm text-[#6B7280]">loading queue…</div>
  const open = items.filter((i) => i.status === 'open')
  const closed = items.filter((i) => i.status !== 'open')
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
        Pending ({open.length})
      </h2>
      <ul className="space-y-1">
        {open.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="w-full rounded border border-[#2A2D34] bg-[#15171D] px-3 py-2 text-left text-sm text-[#E6E8EE] hover:border-[#6B7280]"
            >
              <span
                className={
                  item.kind === 'incident' ? 'text-[#D9534F]' : 'text-[#6B7280]'
                }
              >
                [{KIND_LABEL[item.kind]}]
              </span>{' '}
              {item.title}
            </button>
          </li>
        ))}
        {open.length === 0 && (
          <li className="text-sm text-[#6B7280]">nothing pending. clean board.</li>
        )}
      </ul>
      {closed.length > 0 && (
        <div className="mt-2 text-xs text-[#6B7280]">{closed.length} done/dismissed</div>
      )}
    </section>
  )
}
