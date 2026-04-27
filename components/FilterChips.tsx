'use client'

// Filter chips bound to the zustand store's activeFilter. Active chip
// renders orange (cluster: content) with dark text per spec.
// 'reference' chip covers reference + feedback + instruction kinds
// (the canvas already applies that grouping).

import { useAtlasStore, type FilterKind } from '@/lib/store'

const CHIPS: Array<{ key: FilterKind; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'project', label: 'Projects' },
  { key: 'skill', label: 'Skills' },
  { key: 'agent', label: 'Agents' },
  { key: 'reference', label: 'References' },
]

export default function FilterChips() {
  const activeFilter = useAtlasStore((s) => s.activeFilter)
  const setFilter = useAtlasStore((s) => s.setFilter)

  return (
    <div className="flex items-center gap-1.5">
      {CHIPS.map((chip) => {
        const isActive = activeFilter === chip.key
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            className={
              'rounded-full px-3 py-1 text-[12px] font-medium transition ' +
              (isActive
                ? 'bg-[#E07B4E] text-[#0E1014]'
                : 'border border-[#2A2D34] bg-transparent text-[#6B7280] hover:border-[#E07B4E]/60 hover:text-[#E6E8EE]')
            }
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
