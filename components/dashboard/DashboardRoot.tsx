// Mission control, flight-deck direction (picked 2026-07-09).
// The deck is read in half a second in the dark: a mono status line, the
// site instruments, a quiet inventory, and one amber column of things
// waiting for a hand. Poll cadence: n8n 30s, sites+queue 60s, projects
// 120s, refetch on focus and after mutations.
// Spec: 2026-07-09-mission-control-v2-design.md sections 1, 4.2, 8.

'use client'

import { useCallback, useEffect, useState } from 'react'
import type { N8nPulse, ProjectPulse, QueueItem, SiteCard } from '@/lib/types'
import { usePoll } from './usePoll'
import SiteCardZone from './SiteCardZone'
import N8nRail from './N8nRail'
import ProjectGrid from './ProjectGrid'
import QueuePanel from './QueuePanel'
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

  const [token, setToken] = useState<string | null>(null)
  const [target, setTarget] = useState<DrawerTarget | null>(null)

  useEffect(() => {
    fetch('/api/session-token')
      .then((res) => res.json())
      .then((body: { token?: string }) => setToken(body.token ?? null))
      .catch(() => setToken(null))
  }, [])

  const pathFor = useCallback(
    (projectId: string | null): string | null =>
      projects.data?.find((p) => p.id === projectId)?.path ?? null,
    [projects.data]
  )

  const openItem = useCallback(
    (item: QueueItem) => setTarget({ item, projectPath: pathFor(item.projectId) }),
    [pathFor]
  )

  const openProject = useCallback((project: ProjectPulse) => {
    setTarget({
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
  }, [])

  const changeStatus = useCallback(
    async (id: string, status: 'open' | 'done' | 'dismissed') => {
      if (!token) return
      await fetch(`/api/queue/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Atlas-Token': token,
        },
        body: JSON.stringify({ status }),
      }).catch(() => null)
      queue.refetch()
      setTarget(null)
    },
    [token, queue]
  )

  const recapture = useCallback(async () => {
    if (!token) return
    await fetch('/api/pulse/sites/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Atlas-Token': token,
      },
      body: '{}',
    }).catch(() => null)
  }, [token])

  const openCount = queue.data?.items.filter((i) => i.status === 'open').length ?? null
  const flagged =
    projects.data?.filter((p) => p.git && (p.git.dirty > 0 || p.git.ahead > 0)).length ?? null
  const failing = n8n.data?.recentErrors.length ?? null

  return (
    <div className="min-h-screen bg-deck-bg px-10 py-8 font-sans text-deck-ink">
      {/* status line: the half-second read */}
      <div className="flex items-baseline gap-6 pb-6 font-mono text-xs text-deck-dim">
        <span className="font-semibold tracking-[0.08em] text-deck-ink">CLAUDE OS</span>
        <a href="/map" className="hover:text-deck-ink">
          map →
        </a>
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

      <SiteCardZone sites={sites.data} onRecapture={token ? recapture : null} />

      <div className="mt-12 grid grid-cols-[1fr_380px] gap-16">
        <div className="space-y-10">
          <ProjectGrid projects={projects.data} onSelect={openProject} />
          <N8nRail pulse={n8n.data} />
        </div>
        <QueuePanel items={queue.data?.items ?? null} onSelect={openItem} />
      </div>

      <DetailDrawer
        target={target}
        token={token}
        onClose={() => setTarget(null)}
        onStatusChange={changeStatus}
      />
    </div>
  )
}
