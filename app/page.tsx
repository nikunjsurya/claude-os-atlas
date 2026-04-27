// Top-level server component. Fetches atlas data at request time and hands
// it to the client root. We call buildAtlasResponse directly (rather than
// HTTP-fetching /api/atlas) so the first paint includes the data without
// an extra network roundtrip. The /api/atlas route still exists for V2.

import { getRoots } from '@/lib/paths'
import { buildAtlasResponse } from '@/lib/buildAtlas'
import AtlasRoot from '@/components/AtlasRoot'
import BrowserChrome from '@/components/BrowserChrome'
import HeaderBar from '@/components/HeaderBar'
import StatsBar from '@/components/StatsBar'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const roots = getRoots()
  const data = await buildAtlasResponse({
    memoryDir: roots.memoryDir,
    projectsRoot: roots.projects,
    claudeSkills: roots.claudeSkills,
    agentRoots: [roots.claudeAgents, roots.templatesAgents],
    globalClaudeMd: roots.globalClaudeMd,
  })

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0E1014]">
      <BrowserChrome />
      <HeaderBar />
      <AtlasRoot data={data} />
      <StatsBar stats={data.stats} />
    </div>
  )
}
