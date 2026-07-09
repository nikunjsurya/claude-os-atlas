// Mission control, flight-deck direction (picked 2026-07-09).
// The deck is read in half a second in the dark: a mono status line, the
// site instruments, a quiet inventory, and one amber column of things
// waiting for a hand. Poll cadence: n8n 30s, sites+queue 60s, projects
// 120s, refetch on focus and after mutations.
// Spec: 2026-07-09-mission-control-v2-design.md sections 1, 4.2, 8.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { N8nPulse, ProjectPulse, QueueItem, SiteCard } from '@/lib/types'
import { mutateJson } from '@/lib/clientMutate'
import { usePoll } from './usePoll'
import SiteCardZone from './SiteCardZone'
import N8nRail from './N8nRail'
import ProjectGrid from './ProjectGrid'
import QueuePanel from './QueuePanel'
import DeckMap from './DeckMap'
import DetailDrawer from './DetailDrawer'
import type { DrawerTarget } from './DetailDrawer'

interface QueueBody {
  items: QueueItem[]
  warnings: string[]
}

export default function DashboardRoot() {
  const sites = usePoll<SiteCard[]>('/api/pulse/sites', 60_000)
  const n8n = usePoll<N8nPulse>('/api/pulse/n8n', 30_000)
  const projects = usePoll<ProjectPulse[]>('/api/pulse/projects', 120_000)
  const queue = usePoll<QueueBody>('/api/queue', 60_000)

  const [target, setTarget] = useState<DrawerTarget | null>(null)
  const targetRef = useRef<DrawerTarget | null>(null)
  targetRef.current = target
  // Cross-highlight: hovering a queue item, a project row, or a map node
  // lights the same project everywhere. One organism, one focus.
  const [focusId, setFocusId] = useState<string | null>(null)

  // The drawer participates in browser history: opening pushes one marker
  // entry, so Back closes the drawer instead of leaving the deck. UI closes
  // (esc, the close button, a successful status change) unwind that same
  // entry via history.back() so history never accumulates phantom states.
  const openDrawer = useCallback((t: DrawerTarget) => {
    if (!targetRef.current) window.history.pushState({ atlasDrawer: true }, '')
    setTarget(t)
  }, [])

  const closeDrawer = useCallback(() => {
    if (window.history.state?.atlasDrawer) window.history.back()
    else setTarget(null)
  }, [])

  useEffect(() => {
    // A reload while the drawer was open leaves the marker entry behind;
    // clear it so the first Back press after reload actually navigates.
    if (window.history.state?.atlasDrawer) window.history.replaceState(null, '')
    const onPop = () => setTarget(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const pathFor = useCallback(
    (projectId: string | null): string | null =>
      projects.data?.find((p) => p.id === projectId)?.path ?? null,
    [projects.data]
  )

  const openItem = useCallback(
    (item: QueueItem) => openDrawer({ item, projectPath: pathFor(item.projectId) }),
    [openDrawer, pathFor]
  )

  const openProject = useCallback((project: ProjectPulse) => {
    openDrawer({
      item: {
        id: `adhoc:${project.id}`,
        title: `Work on ${project.label}`,
        projectId: project.id,
        kind: 'claude-task',
        source: 'curated',
        detail: project.git
          ? `Branch \`${project.git.branch}\`, ${project.git.dirty} dirty, ${project.git.ahead} ahead.`
          : 'Git state unknown.',
        promptSeed: '',
        createdAt: new Date().toISOString(),
        status: 'open',
      },
      projectPath: project.path,
    })
  }, [openDrawer])

  const changeStatus = useCallback(
    async (id: string, status: 'open' | 'done' | 'dismissed'): Promise<boolean> => {
      const res = await mutateJson(
        `/api/queue/${encodeURIComponent(id)}`,
        { status },
        'PATCH'
      )
      if (!res?.ok) return false
      queue.refetch()
      closeDrawer()
      return true
    },
    [queue, closeDrawer]
  )

  const recapture = useCallback(async () => {
    await mutateJson('/api/pulse/sites/refresh', {})
  }, [])

  const openCount = queue.data?.items.filter((i) => i.status === 'open').length ?? null
  const flagged =
    projects.data?.filter((p) => p.git && (p.git.dirty > 0 || p.git.ahead > 0)).length ?? null
  const failing = n8n.data?.recentErrors.length ?? null

  return (
    <div className="min-h-screen bg-deck-bg px-10 py-8 font-sans text-deck-ink">
      {/* status line: the half-second read */}
      <div className="flex items-baseline gap-6 pb-6 font-mono text-xs text-deck-dim">
        <span className="font-semibold tracking-[0.08em] text-deck-ink">CLAUDE OS</span>
        <Link href="/map" className="hover:text-deck-ink">
          map →
        </Link>
        {sites.data && (
          <span>
            {sites.data.filter((s) => s.status === 'ok').length}/{sites.data.length} sites up
          </span>
        )}
        {n8n.data && (
          <span className={failing ? 'text-deck-amber' : undefined}>
            {n8n.data.workflows.length} flows · {failing} failing
          </span>
        )}
        {flagged !== null && <span>{flagged} repos unsynced</span>}
        <span
          className="ml-auto"
          style={{ color: openCount ? 'var(--deck-amber)' : 'var(--deck-dim)' }}
        >
          ● {openCount ?? '…'} waiting on you
        </span>
      </div>

      {queue.data?.warnings.map((w) => (
        <div key={w} className="pb-3 font-mono text-[11px] text-deck-amber">
          ▲ {w}
        </div>
      ))}

      <SiteCardZone sites={sites.data} onRecapture={recapture} />

      <div className="mt-12 grid grid-cols-[1fr_380px] gap-16">
        <div className="space-y-10">
          <section>
            <div className="flex items-baseline justify-between pb-3">
              <h2 className="text-[11px] uppercase tracking-[0.12em] text-deck-dim">
                System map
              </h2>
              <Link
                href="/map"
                className="font-mono text-[11px] text-deck-faint hover:text-deck-dim"
              >
                full map →
              </Link>
            </div>
            <div className="relative h-[300px] overflow-hidden rounded-[3px] border border-deck-hair">
              <DeckMap
                projects={projects.data}
                queueItems={queue.data?.items ?? null}
                onSelectProject={openProject}
                focusId={focusId}
                onFocus={setFocusId}
              />
            </div>
          </section>
          <ProjectGrid
            projects={projects.data}
            onSelect={openProject}
            focusId={focusId}
            onFocus={setFocusId}
          />
          <N8nRail pulse={n8n.data} />
        </div>
        <QueuePanel
          items={queue.data?.items ?? null}
          onSelect={openItem}
          focusId={focusId}
          onFocus={setFocusId}
        />
      </div>

      <DetailDrawer target={target} onClose={closeDrawer} onStatusChange={changeStatus} />
    </div>
  )
}
