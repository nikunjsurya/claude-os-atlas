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
    <footer className="flex h-[50px] shrink-0 items-center justify-between gap-4 overflow-x-auto border-t border-[#2A2D34] bg-[#15171D] px-4 md:px-10">
      <div className="flex shrink-0 items-center gap-5 md:gap-8">
        {ITEMS.map((item) => (
          <div key={item.key} className="flex items-baseline gap-2">
            <span className="text-[12px] text-[#6B7280]">{item.label}</span>
            <span className="text-[16px] font-semibold tabular-nums text-[#E6E8EE] md:text-[18px]">
              {stats[item.key]}
            </span>
          </div>
        ))}
      </div>
      <div className="hidden shrink-0 text-[11px] italic text-[#6B7280] md:block">
        auto-derived from MEMORY.md + Projects/
      </div>
    </footer>
  )
}
