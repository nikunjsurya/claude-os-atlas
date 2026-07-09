// Shared one-shot data fetch for the three Phase C direction mockups.
// Throwaway: deleted after the taste-gate pick.

'use client'

import { useEffect, useState } from 'react'
import type { N8nPulse, ProjectPulse, QueueItem, SiteCard } from '@/lib/types'

export interface DirectionData {
  sites: SiteCard[]
  n8n: N8nPulse | null
  projects: ProjectPulse[]
  queue: QueueItem[]
}

export function useDirectionData(): DirectionData | null {
  const [data, setData] = useState<DirectionData | null>(null)
  useEffect(() => {
    Promise.all([
      fetch('/api/pulse/sites').then((r) => r.json()),
      fetch('/api/pulse/n8n').then((r) => r.json()),
      fetch('/api/pulse/projects').then((r) => r.json()),
      fetch('/api/queue').then((r) => r.json()),
    ])
      .then(([sites, n8n, projects, queueBody]) =>
        setData({
          sites: sites as SiteCard[],
          n8n: n8n as N8nPulse,
          projects: projects as ProjectPulse[],
          queue: (queueBody as { items: QueueItem[] }).items,
        })
      )
      .catch(() => setData(null))
  }, [])
  return data
}
