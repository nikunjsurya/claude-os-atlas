// Quiet inventory: every repo on a hairline, dim when synced, ink+amber
// numerals only when carrying work. Click opens the drawer to start a
// session in that repo.

'use client'

import type { ProjectPulse } from '@/lib/types'

export default function ProjectGrid({
  projects,
  onSelect,
  focusId,
  onFocus,
}: {
  projects: ProjectPulse[] | null
  onSelect: (project: ProjectPulse) => void
  focusId: string | null
  onFocus: (id: string | null) => void
}) {
  if (!projects) {
    return <div className="font-mono text-xs text-deck-dim">scanning repos…</div>
  }
  return (
    <section>
      <h2 className="pb-3 text-[11px] uppercase tracking-[0.12em] text-deck-dim">
        Projects
      </h2>
      <div className="grid grid-cols-2 gap-x-12">
        {projects.map((p) => {
          const hot = p.git !== null && (p.git.dirty > 0 || p.git.ahead > 0)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              onMouseEnter={() => onFocus(p.id)}
              onMouseLeave={() => onFocus(null)}
              className={`flex items-baseline gap-2 border-b py-[7px] text-left text-sm hover:bg-deck-panel ${
                focusId === p.id ? 'border-deck-dim bg-deck-panel' : 'border-deck-hair'
              }`}
            >
              <span
                className={
                  hot || focusId === p.id ? 'text-deck-ink' : 'text-deck-dim'
                }
              >
                {p.label}
              </span>
              <span
                className={`ml-auto font-mono text-xs ${hot ? 'text-deck-amber' : 'text-deck-faint'}`}
              >
                {p.git === null
                  ? '?'
                  : hot
                    ? `${p.git.dirty > 0 ? `±${p.git.dirty}` : ''}${p.git.ahead > 0 ? ` ↑${p.git.ahead}` : ''}`
                    : 'synced'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
