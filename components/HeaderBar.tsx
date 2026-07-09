// Header band beneath the browser chrome. Title + tagline left, filter
// chips right. Filter chips own their own state via zustand.

import Link from 'next/link'
import FilterChips from './FilterChips'

interface Props {
  publicMode?: boolean
}

export default function HeaderBar({ publicMode = false }: Props) {
  const tagline = publicMode
    ? 'a force-directed map of every project, skill, and tool I’ve built. click any star.'
    : 'the constellation of what I’ve built'

  return (
    <header className="flex h-[88px] shrink-0 flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-[#2A2D34] bg-[#15171D] px-6 py-3 md:flex-nowrap md:items-center md:justify-between md:px-10">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {!publicMode && (
          <Link
            href="/"
            className="rounded-full border border-[#2A2D34] px-4 py-1.5 text-[13px] text-[#9AA1AC] transition hover:border-[#6B7280] hover:text-[#E6E8EE]"
          >
            ← deck
          </Link>
        )}
        <h1 className="text-[24px] font-semibold tracking-tight text-[#E6E8EE] md:text-[30px]">
          claude OS
        </h1>
        <span className="text-[13px] italic text-[#6B7280] md:text-[16px]">
          {tagline}
        </span>
        {publicMode && (
          <a
            href="https://github.com/nikunjsurya/claude-os-atlas"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-[#6B7280] underline-offset-2 transition hover:text-[#E6E8EE] hover:underline"
          >
            (source on github)
          </a>
        )}
      </div>
      <FilterChips />
    </header>
  )
}
