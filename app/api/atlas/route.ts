// GET /api/atlas. Spec section 5.4: never returns 500 unless this handler
// itself crashes. Returns 200 with partial result + warnings[] on parser
// errors.

import { getRoots } from '@/lib/paths'
import { buildAtlasResponse } from '@/lib/buildAtlas'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const roots = getRoots()
    const response = await buildAtlasResponse({
      memoryDir: roots.memoryDir,
      projectsRoot: roots.projects,
      claudeSkills: roots.claudeSkills,
      agentRoots: [roots.claudeAgents, roots.templatesAgents],
      globalClaudeMd: roots.globalClaudeMd,
    })
    return Response.json(response)
  } catch (err) {
    return Response.json(
      {
        nodes: [],
        edges: [],
        clusters: [],
        stats: { nodes: 0, edges: 0, active: 0, parked: 0, shipped: 0, skills: 0 },
        generatedAt: new Date().toISOString(),
        warnings: [
          `route handler crashed: ${(err as Error).message}`,
        ],
      },
      { status: 200 }
    )
  }
}
