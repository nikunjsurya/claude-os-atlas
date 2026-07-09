// Slide-over drawer: item context + the composer that starts a Claude
// session. Slides in from the right edge it belongs to; Esc closes.

'use client'

import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { QueueItem } from '@/lib/types'
import PromptComposer from './PromptComposer'

export interface DrawerTarget {
  item: QueueItem
  projectPath: string | null
}

export default function DetailDrawer({
  target,
  token,
  onClose,
  onStatusChange,
}: {
  target: DrawerTarget | null
  token: string | null
  onClose: () => void
  onStatusChange: (id: string, status: 'open' | 'done' | 'dismissed') => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!target) return null
  const { item } = target
  const incident = item.kind === 'incident'

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-[440px] flex-col overflow-y-auto border-l border-deck-hair bg-deck-panel p-5 shadow-[-24px_0_48px_rgba(0,0,0,0.5)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div
            className={`font-mono text-[11px] uppercase tracking-[0.12em] ${incident ? 'text-deck-amber' : 'text-deck-dim'}`}
          >
            {incident ? '▲ ' : ''}
            {item.kind} · {item.source}
          </div>
          <h3 className="mt-1.5 text-lg font-medium text-deck-ink">{item.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 font-mono text-xs text-deck-faint hover:text-deck-ink"
        >
          esc
        </button>
      </div>

      <div className="mt-3 max-h-44 overflow-y-auto text-sm leading-relaxed text-deck-dim [&_code]:font-mono [&_code]:text-deck-ink">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.detail}</ReactMarkdown>
      </div>

      {/* Ad-hoc project launches are not queue items; status buttons would
          write overrides for ids the queue never serves. */}
      <div className={`mt-4 flex gap-2 font-mono text-xs ${item.id.startsWith('adhoc:') ? 'hidden' : ''}`}>
        {item.status === 'open' ? (
          <>
            <button
              type="button"
              onClick={() => onStatusChange(item.id, 'done')}
              className="rounded-[3px] border border-deck-hair px-3 py-1.5 text-deck-dim hover:border-deck-dim hover:text-deck-ink"
            >
              mark done
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(item.id, 'dismissed')}
              className="rounded-[3px] border border-deck-hair px-3 py-1.5 text-deck-faint hover:border-deck-dim hover:text-deck-dim"
            >
              dismiss
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onStatusChange(item.id, 'open')}
            className="rounded-[3px] border border-deck-hair px-3 py-1.5 text-deck-amber"
          >
            reopen
          </button>
        )}
      </div>

      <div className="mt-6 border-t border-deck-hair pt-5">
        <PromptComposer
          key={item.id}
          seed={item.promptSeed}
          projectId={item.projectId}
          token={token}
        />
      </div>
    </div>
  )
}
