// Shared 60s TTL cache over the full-filesystem atlas build, so the
// dashboard widget, /map, and /api/atlas stop paying the ~1.5s parser
// walk on every request. Local mode only; public mode reads the snapshot.

import { createTtlCache } from '@/lib/collectors/cache'
import { getRoots } from '@/lib/paths'
import { buildAtlasResponse } from '@/lib/buildAtlas'
import type { AtlasResponse } from '@/lib/types'

const cache = createTtlCache<AtlasResponse>(() => {
  const roots = getRoots()
  return buildAtlasResponse({
    memoryDir: roots.memoryDir,
    projectsRoot: roots.projects,
    claudeSkills: roots.claudeSkills,
    agentRoots: [roots.claudeAgents, roots.templatesAgents],
    globalClaudeMd: roots.globalClaudeMd,
  })
}, 60_000)

export function getAtlasCached(): Promise<AtlasResponse> {
  return cache.get()
}
