// Bottom 50px stats strip. Reads the 6 derived counts from
// AtlasResponse.stats and renders them with dim labels + bright values.
// Right side carries a small auto-derived credit line.

import type { AtlasStats } from '@/lib/types'

interface Props {
  stats: AtlasStats
}

const ITEMS: Array<{ key: keyof AtlasStats; label: string }> = [
  { key: 'nodes', label: 'nodes' },
  { key: 'edges', label: 'edges' },
  { key: 'active', label: 'active' },
  { key: 'parked', label: 'parked' },
  { key: 'shipped', label: 'shipped' },
  { key: 'skills', label: 'skills' },
]

export default function StatsBar({ stats }: Props) {
  return (
    <footer className="flex h-[50px] shrink-0 items-center justify-between border-t border-[#2A2D34] bg-[#15171D] px-6">
      <div className="flex items-center gap-6">
        {ITEMS.map((item) => (
          <div key={item.key} className="flex items-baseline gap-1.5">
            <span className="text-[14px] font-semibold tabular-nums text-[#E6E8EE]">
              {stats[item.key]}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-[#6B7280]">
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <div className="text-[10px] italic text-[#6B7280]">
        auto-derived from MEMORY.md + Projects/
      </div>
    </footer>
  )
}
