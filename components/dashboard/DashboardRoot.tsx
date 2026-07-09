// Mission control client root: owns polling (n8n 30s, sites+queue 60s,
// projects 120s, focus/mutation refetch), the session token, and the
// drawer. Phase B skeleton; Phase C restyles through the taste gate.
// Spec: 2026-07-09-mission-control-v2-design.md sections 1, 4.2.

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

  return (
    <div className="min-h-screen bg-[#0E1014] p-4 text-[#E6E8EE]">
      <header className="mb-4 flex items-baseline gap-3">
        <h1 className="text-lg font-semibold">claude OS · mission control</h1>
        <a href="/map" className="text-sm text-[#6B7280] hover:text-[#E6E8EE]">
          map →
        </a>
        {queue.data?.warnings.map((w) => (
          <span key={w} className="text-xs text-[#E07B4E]">
            {w}
          </span>
        ))}
      </header>

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <SiteCardZone sites={sites.data} />
          <ProjectGrid projects={projects.data} onSelect={openProject} />
        </div>
        <div className="space-y-4">
          <QueuePanel items={queue.data?.items ?? null} onSelect={openItem} />
          <N8nRail pulse={n8n.data} />
        </div>
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
