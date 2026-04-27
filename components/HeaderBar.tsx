// Header band beneath the browser chrome. Title + tagline left, filter
// chips right. Filter chips own their own state via zustand.

import FilterChips from './FilterChips'

export default function HeaderBar() {
  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#2A2D34] bg-[#15171D] px-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[20px] font-semibold tracking-tight text-[#E6E8EE]">
          claude OS
        </h1>
        <span className="text-[12px] italic text-[#6B7280]">
          the constellation of what I&apos;ve built
        </span>
      </div>
      <FilterChips />
    </header>
  )
}
