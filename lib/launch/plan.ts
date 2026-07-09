// Launch planning: validates a LaunchRequest against the project allowlist
// and produces every path/argv the spawn layer needs. Pure and fully
// testable; no user input ever reaches a shell string.
// Spec: 2026-07-09-mission-control-v2-design.md section 6.

export const PROMPT_MAX_CHARS = 20000

export interface KnownProject {
  id: string
  path: string
}

export interface PlanInputs {
  projectId: string
  prompt: string
  terminal?: unknown
  projects: KnownProject[]
  repoRoot: string
  launchDirPath: string
  appDataDir: string | null
  timestamp: Date
}

export interface LaunchPlan {
  projectId: string
  projectPath: string
  promptFile: string
  promptContent: string
  shimPath: string
  terminal: 'warp' | 'wt'
  wtArgv: string[]
  warpConfigPath: string | null
  warpUri: string | null
}

export type PlanResult =
  | { ok: true; plan: LaunchPlan }
  | { ok: false; status: number; error: string }

export function toPosix(p: string): string {
  return p.replace(/\\/g, '/')
}

export function planLaunch(inputs: PlanInputs): PlanResult {
  const terminal = inputs.terminal === undefined ? 'warp' : inputs.terminal
  if (terminal !== 'warp' && terminal !== 'wt') {
    return { ok: false, status: 400, error: 'terminal must be "warp" or "wt"' }
  }

  const prompt = inputs.prompt ?? ''
  if (prompt.trim().length === 0) {
    return { ok: false, status: 400, error: 'prompt must not be empty' }
  }
  if (prompt.length > PROMPT_MAX_CHARS) {
    return {
      ok: false,
      status: 400,
      error: `prompt exceeds ${PROMPT_MAX_CHARS} characters`,
    }
  }

  const project = inputs.projects.find((p) => p.id === inputs.projectId)
  if (!project) {
    return { ok: false, status: 404, error: `unknown project "${inputs.projectId}"` }
  }

  const stamp = inputs.timestamp
    .toISOString()
    .replace(/[:.]/g, '-')
  const safeId = inputs.projectId.replace(/[^A-Za-z0-9_-]/g, '-')
  const promptFile = `${toPosix(inputs.launchDirPath)}/${stamp}-${safeId}.md`
  const shimPath = `${toPosix(inputs.repoRoot)}/scripts/launch-claude.mjs`

  // Empirically verified 2026-07-09: Warp on Windows reads launch configs
  // from %APPDATA%\warp\Warp\data\launch_configurations (the data segment is
  // required; the docs' path without it is silently ignored), and executes
  // warp://launch/<file>.yaml handed to `cmd /c start`.
  const warpConfigPath = inputs.appDataDir
    ? `${toPosix(inputs.appDataDir)}/warp/Warp/data/launch_configurations/atlas-launch.yaml`
    : null

  return {
    ok: true,
    plan: {
      projectId: project.id,
      projectPath: project.path,
      promptFile,
      promptContent: prompt,
      shimPath,
      terminal,
      wtArgv: ['wt', '-d', project.path, 'node', shimPath, promptFile],
      warpConfigPath,
      warpUri: warpConfigPath ? 'warp://launch/atlas-launch.yaml' : null,
    },
  }
}
