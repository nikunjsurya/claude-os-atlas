'use client'

// Client root that composes the canvas + side panel. Receives atlas data
// from the server component (page.tsx) so the constellation renders on
// first paint without a client-side fetch.

import { useState } from 'react'
import type { AtlasResponse } from '@/lib/types'
import ConstellationCanvas from './ConstellationCanvas'
import NodeDetailPanel from './NodeDetailPanel'

interface Props {
  data: AtlasResponse
}

export default function AtlasRoot({ data }: Props) {
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const isEmpty = data.nodes.length === 0
  const showWarnings = !bannerDismissed && (data.warnings?.length ?? 0) > 0

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="relative min-h-0 flex-1">
        {isEmpty ? (
          <EmptyState warnings={data.warnings} />
        ) : (
          <ConstellationCanvas data={data} />
        )}
        {showWarnings && !isEmpty && (
          <WarningsBanner
            warnings={data.warnings!}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}
      </div>
      <NodeDetailPanel data={data} />
    </div>
  )
}

function EmptyState({ warnings }: { warnings?: string[] }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="text-[11px] uppercase tracking-wider text-[#6B7280]">
        no data
      </div>
      <div className="mt-3 max-w-md text-[15px] leading-snug text-[#E6E8EE]">
        Atlas could not load any nodes from MEMORY.md, ~/.claude, or ~/Projects.
      </div>
      {warnings && warnings.length > 0 && (
        <ul className="mt-6 max-w-xl space-y-1.5 text-left text-[12px] text-[#9CA3AF]">
          {warnings.slice(0, 6).map((w, i) => (
            <li key={i} className="font-mono">
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function WarningsBanner({
  warnings,
  onDismiss,
}: {
  warnings: string[]
  onDismiss: () => void
}) {
  return (
    <div className="absolute left-4 top-4 z-10 max-w-md rounded-md border border-[#7a5d2a] bg-[#2a1f10]/95 px-3 py-2 text-[11px] text-[#E6C77A] shadow-lg backdrop-blur">
      <div className="flex items-start gap-3">
        <span className="font-semibold">
          {warnings.length} parser warning{warnings.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto text-[#E6C77A]/70 transition hover:text-white"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <ul className="mt-1.5 space-y-0.5 text-[#E6C77A]/80">
        {warnings.slice(0, 3).map((w, i) => (
          <li key={i} className="truncate font-mono">
            {w}
          </li>
        ))}
        {warnings.length > 3 && (
          <li className="text-[#E6C77A]/60">
            … and {warnings.length - 3} more
          </li>
        )}
      </ul>
    </div>
  )
}
