import { describe, expect, it } from 'vitest'
import { planLaunch } from './plan'
import type { PlanInputs } from './plan'
import { renderWarpConfig } from './warpConfig'

const PROJECTS = [
  { id: 'project-vaani', path: 'C:\\Users\\surya\\Projects\\vaani' },
  { id: 'project-primal-rescue', path: 'C:\\Users\\surya\\Projects\\Primal Rescue' },
]

function inputs(over: Partial<PlanInputs> = {}): PlanInputs {
  return {
    projectId: 'project-vaani',
    prompt: 'Fix the failing tests in the audio module.',
    terminal: 'warp',
    projects: PROJECTS,
    repoRoot: 'C:\\Users\\surya\\Projects\\claude-os-atlas',
    launchDirPath: 'C:\\Users\\surya\\Projects\\claude-os-atlas\\data\\launch',
    appDataDir: 'C:\\Users\\surya\\AppData\\Roaming',
    timestamp: new Date('2026-07-09T12:00:00.000Z'),
    ...over,
  }
}

describe('planLaunch', () => {
  it('rejects a projectId that is not in the allowlist with 404', () => {
    const result = planLaunch(inputs({ projectId: 'project-ghost' }))
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('rejects traversal-style ids because they cannot be in the allowlist', () => {
    const result = planLaunch(inputs({ projectId: '../../windows/system32' }))
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('rejects an empty prompt and a prompt over the 20k cap with 400', () => {
    expect(planLaunch(inputs({ prompt: '  ' }))).toMatchObject({ ok: false, status: 400 })
    expect(planLaunch(inputs({ prompt: 'x'.repeat(20001) }))).toMatchObject({
      ok: false,
      status: 400,
    })
  })

  it('rejects an unknown terminal and defaults a missing one to warp', () => {
    expect(planLaunch(inputs({ terminal: 'bash' }))).toMatchObject({ ok: false, status: 400 })
    const result = planLaunch(inputs({ terminal: undefined }))
    expect(result.ok && result.plan.terminal).toBe('warp')
  })

  it('emits forward-slash space-free shim and prompt paths', () => {
    const result = planLaunch(inputs())
    if (!result.ok) throw new Error(result.error)
    expect(result.plan.shimPath).toBe(
      'C:/Users/surya/Projects/claude-os-atlas/scripts/launch-claude.mjs'
    )
    expect(result.plan.promptFile).toMatch(
      /^C:\/Users\/surya\/Projects\/claude-os-atlas\/data\/launch\/[A-Za-z0-9._-]+\.md$/
    )
    expect(result.plan.promptFile).not.toContain(' ')
  })

  it('builds a wt argv that passes only paths, never prompt content', () => {
    const result = planLaunch(inputs({ terminal: 'wt' }))
    if (!result.ok) throw new Error(result.error)
    expect(result.plan.wtArgv[0]).toBe('wt')
    expect(result.plan.wtArgv).toContain('-d')
    expect(result.plan.wtArgv).toContain('C:\\Users\\surya\\Projects\\vaani')
    expect(result.plan.wtArgv.join(' ')).not.toContain('Fix the failing')
    expect(result.plan.wtArgv).toContain(result.plan.promptFile)
  })

  it('places the warp config under APPDATA and forms a warp://launch URI', () => {
    const result = planLaunch(inputs())
    if (!result.ok) throw new Error(result.error)
    expect(result.plan.warpConfigPath).toBe(
      'C:/Users/surya/AppData/Roaming/warp/Warp/data/launch_configurations/atlas-launch.yaml'
    )
    expect(result.plan.warpUri).toContain('warp://launch/')
  })
})

describe('renderWarpConfig', () => {
  it('quotes the cwd (spaces allowed there) and keeps prompt content out of the YAML', () => {
    const result = planLaunch(inputs({ projectId: 'project-primal-rescue' }))
    if (!result.ok) throw new Error(result.error)
    const yaml = renderWarpConfig(result.plan, 'Primal Rescue')
    expect(yaml).toContain('"C:/Users/surya/Projects/Primal Rescue"')
    expect(yaml).toContain(`node ${result.plan.shimPath} ${result.plan.promptFile}`)
    expect(yaml).not.toContain('Fix the failing')
  })
})
