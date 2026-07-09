// Slide-over drawer: item status + detail + the PromptComposer that starts
// a Claude session on it. Esc closes.

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

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-[440px] flex-col border-l border-[#2A2D34] bg-[#15171D] p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-[#6B7280]">
            {item.kind} · {item.source}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-[#E6E8EE]">{item.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-sm text-[#6B7280] hover:text-[#E6E8EE]"
        >
          esc
        </button>
      </div>

      <div className="prose prose-invert mt-3 max-h-48 overflow-y-auto text-sm text-[#c8ccd6]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.detail}</ReactMarkdown>
      </div>

      <div className="mt-3 flex gap-2">
        {item.status === 'open' ? (
          <>
            <button
              type="button"
              onClick={() => onStatusChange(item.id, 'done')}
              className="rounded border border-[#2A2D34] px-3 py-1 text-sm text-[#5AA77A] hover:border-[#5AA77A]"
            >
              mark done
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(item.id, 'dismissed')}
              className="rounded border border-[#2A2D34] px-3 py-1 text-sm text-[#6B7280] hover:border-[#6B7280]"
            >
              dismiss
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onStatusChange(item.id, 'open')}
            className="rounded border border-[#2A2D34] px-3 py-1 text-sm text-[#E07B4E]"
          >
            reopen
          </button>
        )}
      </div>

      <div className="mt-4 flex-1 overflow-y-auto">
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
