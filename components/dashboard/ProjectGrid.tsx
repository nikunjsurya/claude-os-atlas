// Project grid: one chip per repo with git badges. Clicking a project
// opens the drawer with a blank work prompt for it.

'use client'

import type { ProjectPulse } from '@/lib/types'
import PulseDot from './PulseDot'

export default function ProjectGrid({
  projects,
  onSelect,
}: {
  projects: ProjectPulse[] | null
  onSelect: (project: ProjectPulse) => void
}) {
  if (!projects) return <div className="text-sm text-[#6B7280]">loading projects…</div>
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
        Projects
      </h2>
      <div className="grid grid-cols-4 gap-2">
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className="flex items-center gap-2 rounded border border-[#2A2D34] bg-[#15171D] px-2 py-1.5 text-left text-sm text-[#E6E8EE] hover:border-[#6B7280]"
          >
            <PulseDot status={p.status} />
            <span className="truncate">{p.label}</span>
            {p.git && (p.git.dirty > 0 || p.git.ahead > 0) && (
              <span className="ml-auto shrink-0 text-xs text-[#E07B4E]">
                {p.git.dirty > 0 ? `±${p.git.dirty}` : ''}
                {p.git.ahead > 0 ? ` ↑${p.git.ahead}` : ''}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
