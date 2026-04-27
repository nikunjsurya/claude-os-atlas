'use client'

// Right-side panel. Subscribes to selectedId from the store and the full
// atlas data passed in via props. Renders the empty state when nothing is
// picked, otherwise the status pill + metadata + linked nodes + sparkline +
// action buttons (per spec section 6.5).

import { useMemo } from 'react'
import type { AtlasNode, AtlasResponse } from '@/lib/types'
import { useAtlasStore } from '@/lib/store'
import ActivitySparkline from './ActivitySparkline'
import NodeBody from './NodeBody'

const STATUS_COLORS: Record<AtlasNode['status'], string> = {
  active: '#5AA77A',
  shipped: '#5BA3B5',
  parked: '#6B7280',
  reference: '#9F7AEA',
}

interface Props {
  data: AtlasResponse
}

export default function NodeDetailPanel({ data }: Props) {
  const selectedId = useAtlasStore((s) => s.selectedId)
  const setSelected = useAtlasStore((s) => s.setSelected)

  const nodeIndex = useMemo(() => {
    const m = new Map<string, AtlasNode>()
    for (const n of data.nodes) m.set(n.id, n)
    return m
  }, [data.nodes])

  const selected = selectedId ? nodeIndex.get(selectedId) ?? null : null

  const linkedNodes = useMemo(() => {
    if (!selected) return []
    const ids = new Set<string>()
    for (const e of data.edges) {
      if (e.source === selected.id) ids.add(e.target)
      else if (e.target === selected.id) ids.add(e.source)
    }
    return Array.from(ids)
      .map((id) => nodeIndex.get(id))
      .filter((n): n is AtlasNode => Boolean(n))
      .slice(0, 6)
  }, [selected, data.edges, nodeIndex])

  if (!selected) {
    return (
      <aside className="flex h-full w-[380px] flex-col border-l border-[#2A2D34] bg-[#15171D]">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-[13px] uppercase tracking-wider text-[#6B7280]">Pick a node</div>
          <div className="mt-2 text-[15px] text-[#E6E8EE]">
            Click any star to see what it is and how it links to the rest.
          </div>

          <div className="mt-8 text-[11px] uppercase tracking-wider text-[#6B7280]">Clusters</div>
          <ul className="mt-3 space-y-2">
            {data.clusters.map((c) => (
              <li key={c.id} className="flex items-center gap-3 text-[13px] text-[#E6E8EE]">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span className="capitalize">{c.label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 text-[11px] uppercase tracking-wider text-[#6B7280]">Status</div>
          <ul className="mt-3 space-y-2">
            {(['active', 'shipped', 'parked', 'reference'] as const).map((s) => (
              <li key={s} className="flex items-center gap-3 text-[13px] text-[#E6E8EE]">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[s] }}
                />
                <span className="capitalize">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    )
  }

  const statusColor = STATUS_COLORS[selected.status]
  const lastTouched = formatDate(selected.lastTouched)

  return (
    <aside className="flex h-full w-[380px] flex-col border-l border-[#2A2D34] bg-[#15171D]">
      <div className="flex-1 overflow-y-auto p-6">
        {/* Status pill */}
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#0E1014]"
            style={{ backgroundColor: statusColor }}
          >
            {selected.status}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-[#6B7280]">{selected.kind}</span>
        </div>

        {/* Label + description */}
        <h2 className="mt-4 text-[26px] font-semibold leading-tight text-[#E6E8EE]">
          {selected.label}
        </h2>
        {selected.description && (
          <p className="mt-2 text-[13px] italic text-[#6B7280]">{selected.description}</p>
        )}

        <div className="my-5 h-px bg-[#2A2D34]" />

        {/* Metadata rows */}
        <dl className="space-y-2.5 text-[13px]">
          <Row label="type" value={selected.kind} />
          <Row label="status" value={selected.status} />
          <Row label="last touch" value={lastTouched} />
          {selected.links.memoryFile && (
            <Row label="memory ref" value={selected.links.memoryFile} mono />
          )}
          {selected.links.repo && <Row label="repo" value={selected.links.repo} mono />}
          {selected.links.vault && <Row label="vault" value={selected.links.vault} mono />}
        </dl>

        {/* LINKED list */}
        {linkedNodes.length > 0 && (
          <>
            <div className="mt-6 text-[11px] uppercase tracking-wider text-[#6B7280]">Linked</div>
            <ul className="mt-2 space-y-2">
              {linkedNodes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(n.id)}
                    className="flex w-full items-center gap-2.5 rounded px-1 py-0.5 text-left text-[13px] text-[#E6E8EE] transition hover:bg-[#1d2027] hover:text-white"
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[n.status] }}
                    />
                    <span className="truncate">{n.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Activity sparkline. Bucket selected + linked node lastTouched
            into 30 daily buckets. */}
        <div className="mt-6 text-[11px] uppercase tracking-wider text-[#6B7280]">Activity (30 days)</div>
        <div className="mt-2">
          <ActivitySparkline
            timestamps={[selected.lastTouched, ...linkedNodes.map((n) => n.lastTouched)]}
            color={statusColor}
          />
        </div>

        {/* Body markdown */}
        {selected.bodyMarkdown && (
          <div className="mt-6 border-t border-[#2A2D34] pt-4">
            <NodeBody markdown={selected.bodyMarkdown} />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 border-t border-[#2A2D34] p-4">
        <ActionButton
          label="Open in vault"
          color="#E07B4E"
          href={selected.links.vault ? `obsidian://open?path=${encodeURIComponent(selected.links.vault)}` : undefined}
        />
        <ActionButton
          label="View memory"
          color="#6B7280"
          href={selected.links.memoryFile ? `file://${selected.source.path}` : undefined}
        />
      </div>
    </aside>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-[110px] shrink-0 text-[11px] uppercase tracking-wider text-[#6B7280]">
        {label}
      </dt>
      <dd
        className={
          'flex-1 text-[13px] text-[#E6E8EE] ' +
          (mono ? 'font-mono break-all' : '')
        }
      >
        {value}
      </dd>
    </div>
  )
}

function ActionButton({
  label,
  color,
  href,
}: {
  label: string
  color: string
  href?: string
}) {
  const disabled = !href
  return (
    <a
      href={href ?? '#'}
      aria-disabled={disabled}
      onClick={(e) => disabled && e.preventDefault()}
      className={
        'block rounded-md border px-3 py-2 text-center text-[12px] font-medium transition ' +
        (disabled
          ? 'cursor-not-allowed border-[#2A2D34] text-[#6B7280] opacity-50'
          : 'border-[#2A2D34] text-[#E6E8EE] hover:bg-[#1d2027]')
      }
      style={!disabled ? { borderColor: color, color } : undefined}
    >
      {label}
    </a>
  )
}

function formatDate(iso: string): string {
  if (!iso) return 'unknown'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return iso
  }
}
