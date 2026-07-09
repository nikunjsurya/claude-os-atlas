// The V1 constellation screen, extracted so both public-mode `/` and `/map`
// render the same component (extraction, not duplication).
// Spec: 2026-07-09-mission-control-v2-design.md section 4.4.

import path from 'node:path'
import fs from 'node:fs/promises'
import { getRoots } from '@/lib/paths'
import { buildAtlasResponse } from '@/lib/buildAtlas'
import type { AtlasResponse } from '@/lib/types'
import AtlasRoot from '@/components/AtlasRoot'
import BrowserChrome from '@/components/BrowserChrome'
import HeaderBar from '@/components/HeaderBar'
import StatsBar from '@/components/StatsBar'

const PUBLIC_MODE = process.env.NEXT_PUBLIC_ATLAS_MODE === 'public'

async function loadData(): Promise<AtlasResponse> {
  if (PUBLIC_MODE) {
    const snapshotPath = path.join(process.cwd(), 'data', 'atlas-snapshot.json')
    const raw = await fs.readFile(snapshotPath, 'utf8')
    return JSON.parse(raw) as AtlasResponse
  }
  const roots = getRoots()
  return buildAtlasResponse({
    memoryDir: roots.memoryDir,
    projectsRoot: roots.projects,
    claudeSkills: roots.claudeSkills,
    agentRoots: [roots.claudeAgents, roots.templatesAgents],
    globalClaudeMd: roots.globalClaudeMd,
  })
}

export default async function ConstellationPage() {
  const data = await loadData()

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0E1014]">
      <BrowserChrome />
      <HeaderBar publicMode={PUBLIC_MODE} />
      <AtlasRoot data={data} />
      <StatsBar stats={data.stats} />
    </div>
  )
}
