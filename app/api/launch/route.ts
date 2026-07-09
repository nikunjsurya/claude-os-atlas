// POST /api/launch: validate against the project allowlist, write the
// prompt file, launch Warp (fallback wt) running claude in the project dir.
// The single most sensitive route in the app; every guard leg applies.
// Spec: 2026-07-09-mission-control-v2-design.md sections 6, 7.

import { checkMutatingRequest, getSessionToken, publicMode404 } from '@/lib/guard'
import { launchDir } from '@/lib/dataDir'
import { getProjectPulses } from '@/lib/collectors/registry'
import { planLaunch } from '@/lib/launch/plan'
import { executeLaunch } from '@/lib/launch/spawn'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const gated = publicMode404()
  if (gated) return gated
  const verdict = checkMutatingRequest(request, getSessionToken())
  if (!verdict.ok) {
    return Response.json({ error: verdict.reason }, { status: verdict.status })
  }

  const body = (await request.json().catch(() => null)) as {
    projectId?: unknown
    prompt?: unknown
    terminal?: unknown
  } | null
  if (!body) {
    return Response.json({ error: 'body must be JSON' }, { status: 400 })
  }

  const projects = await getProjectPulses()
  const result = planLaunch({
    projectId: String(body.projectId ?? ''),
    prompt: String(body.prompt ?? ''),
    terminal: body.terminal,
    projects: projects.map((p) => ({ id: p.id, path: p.path })),
    repoRoot: process.cwd(),
    launchDirPath: launchDir(),
    appDataDir: process.env.APPDATA ?? null,
    timestamp: new Date(),
  })
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  const label = projects.find((p) => p.id === result.plan.projectId)?.label
  const outcome = await executeLaunch(result.plan, label ?? result.plan.projectId)
  if (!outcome.launched) {
    return Response.json(
      { error: outcome.error, promptFile: outcome.promptFile },
      { status: 502 }
    )
  }
  return Response.json(outcome)
}
