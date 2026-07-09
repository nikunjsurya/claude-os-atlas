// Needs a hand: the only bright column on the deck. Incidents first with
// the amber caution mark; owner actions and claude tasks in ink below.

'use client'

import type { QueueItem } from '@/lib/types'

export default function QueuePanel({
  items,
  onSelect,
  focusId,
  onFocus,
}: {
  items: QueueItem[] | null
  onSelect: (item: QueueItem) => void
  focusId: string | null
  onFocus: (id: string | null) => void
}) {
  if (!items) {
    return <div className="font-mono text-xs text-deck-dim">reading the queue…</div>
  }
  const open = items.filter((i) => i.status === 'open')
  const incidents = open.filter((i) => i.kind === 'incident')
  const rest = open.filter((i) => i.kind !== 'incident')
  const closed = items.length - open.length

  return (
    <section>
      <h2 className="pb-3 text-[11px] uppercase tracking-[0.12em] text-deck-amber">
        Needs a hand · {open.length}
      </h2>
      {open.length === 0 && (
        <div className="font-mono text-xs text-deck-dim">
          deck is dark. nothing needs you.
        </div>
      )}
      {incidents.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          className="block w-full border-b border-deck-hair py-2 text-left hover:bg-deck-panel"
        >
          <span className="text-sm text-deck-amber">▲ {item.title}</span>
        </button>
      ))}
      {rest.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          onMouseEnter={() => item.projectId && onFocus(item.projectId)}
          onMouseLeave={() => onFocus(null)}
          className={`block w-full border-b py-2 text-left hover:bg-deck-panel ${
            focusId !== null && focusId === item.projectId
              ? 'border-deck-dim bg-deck-panel'
              : 'border-deck-hair'
          }`}
        >
          <span className="block text-sm text-deck-ink">{item.title}</span>
          <span className="block pt-0.5 font-mono text-[11px] text-deck-dim">
            {item.kind}
            {item.projectId ? ` · ${item.projectId.replace('project-', '')}` : ''}
          </span>
        </button>
      ))}
      {closed > 0 && (
        <div className="pt-2 font-mono text-[11px] text-deck-faint">
          {closed} done or dismissed
        </div>
      )}
    </section>
  )
}
